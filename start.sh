#!/bin/bash
# ============================================================
# start.sh — Velocity Proxy + Panel Startup
# ============================================================

PROXY_DIR="/proxy"
DATA_DIR="/data"
MEMORY="${MEMORY:-2G}"

cd "$PROXY_DIR"

# ---- Persistent data: sync configs from image to volume ----
mkdir -p "$DATA_DIR/logs" "$DATA_DIR/plugins"

# Copy velocity.toml to data dir if not present (or always refresh from image)
IMAGE_VERSION=$(cat /proxy/.image-version 2>/dev/null || echo "unknown")
DATA_VERSION=$(cat /data/.image-version 2>/dev/null || echo "none")

if [ "$IMAGE_VERSION" != "$DATA_VERSION" ]; then
    echo "Image version changed ($DATA_VERSION -> $IMAGE_VERSION), refreshing configs..."
    cp -f "$PROXY_DIR/velocity.toml" "$DATA_DIR/velocity.toml"
    [ -f "$PROXY_DIR/forwarding.secret" ] && cp -f "$PROXY_DIR/forwarding.secret" "$DATA_DIR/forwarding.secret"
    echo "$IMAGE_VERSION" > "$DATA_DIR/.image-version"
else
    echo "Image version unchanged, keeping existing configs."
fi

# Ensure velocity.toml exists in data
[ -f "$DATA_DIR/velocity.toml" ] || cp "$PROXY_DIR/velocity.toml" "$DATA_DIR/velocity.toml"

# ---- Update backend server address from env var ----
if [ -n "$BACKEND_HOST" ]; then
    echo "Configuring backend server: $BACKEND_HOST"
    sed -i "s|bedwars = \".*\"|bedwars = \"$BACKEND_HOST\"|" "$DATA_DIR/velocity.toml"
fi

# ---- Clean old logs ----
if [ -d "$DATA_DIR/logs" ]; then
    find "$DATA_DIR/logs" -name '*.log.gz' -mtime +1 -delete 2>/dev/null
    find "$DATA_DIR/logs" -name '*.log' ! -name 'latest.log' -mtime +1 -delete 2>/dev/null
fi


# ---- Start Velocity Proxy ----
echo "Starting Velocity proxy with ${MEMORY} RAM..."
cd "$DATA_DIR"
java -Xms${MEMORY} -Xmx${MEMORY} \
    -XX:+UseG1GC \
    -XX:G1HeapRegionSize=4M \
    -XX:+UnlockExperimentalVMOptions \
    -XX:+ParallelRefProcEnabled \
    -XX:+AlwaysPreTouch \
    -XX:MaxInlineLevel=15 \
    -jar /proxy/velocity.jar &

VELOCITY_PID=$!
echo "Velocity started with PID $VELOCITY_PID"

# Wait for Velocity to create log file
sleep 3
touch "$DATA_DIR/logs/latest.log"

# ---- Start Panel ----
echo "Starting proxy panel..."
cd /proxy/panel
node server.js &
PANEL_PID=$!
echo "Panel started with PID $PANEL_PID"

# Wait for Velocity process
wait $VELOCITY_PID
EXIT_CODE=$?
echo "Velocity exited with code $EXIT_CODE"

# Kill panel when Velocity exits
kill $PANEL_PID 2>/dev/null
exit $EXIT_CODE

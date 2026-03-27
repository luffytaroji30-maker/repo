#!/bin/bash
# Fix Railway volume permissions (volume mounts as root)
if [ -d /data ]; then
    # Clean massive log files before chown
    if [ -d /data/logs ]; then
        echo "Cleaning old proxy log files..."
        rm -f /data/logs/*.log.gz 2>/dev/null
        echo "" > /data/logs/latest.log 2>/dev/null
    fi
    chown -R velocity:velocity /data
fi

# Drop to velocity user and run start.sh
exec su -s /bin/bash velocity -c "export PATH='$PATH'; /proxy/start.sh"

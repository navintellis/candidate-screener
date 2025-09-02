#!/bin/sh
set -e

# Default environment
NODE_ENV=${NODE_ENV:-localhost}

echo "🐳 Starting Audio Manager in $NODE_ENV environment..."

# Load environment-specific configuration
ENV_FILE=".env.$NODE_ENV"
if [ -f "$ENV_FILE" ]; then
    echo "📋 Loading environment file: $ENV_FILE"
else
    echo "⚠️  Environment file $ENV_FILE not found, using process.env fallback"
fi

# Display configuration summary
echo "🔧 Configuration:"
echo "   Environment: $NODE_ENV"
echo "   Port: ${PORT:-3000}"
echo "   Host: ${HOST:-localhost}"
echo "   Storage: ${STORAGE_TYPE:-filesystem}"

# Create directories if they don't exist
mkdir -p candidate-data processed-data uploads generated-audio samples

echo "🚀 Starting server..."

# Start the application based on environment
case "$NODE_ENV" in
    "localhost"|"development")
        exec npm run start:localhost
        ;;
    "staging")
        exec npm run start:staging
        ;;
    "production")
        # If we add a production environment later
        exec npm run start:staging
        ;;
    *)
        echo "⚠️  Unknown environment: $NODE_ENV, defaulting to localhost"
        exec npm run start:localhost
        ;;
esac 
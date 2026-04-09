"""Ground Control web application."""

# Hydrate /run/secrets before importing docker_runtime: that module pulls in secrets_database,
# which builds the engine from config at import time (needs GROUND_CONTROL_POSTGRES_PASSWORD).
from app.docker_secrets import hydrate_docker_secrets_into_environ

hydrate_docker_secrets_into_environ()

from app.docker_runtime import prepare_docker_runtime_if_configured

prepare_docker_runtime_if_configured()

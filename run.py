#!/usr/bin/env python3
"""One-command launcher for the full Prompt BI HTTP stack."""

from __future__ import annotations

import argparse
import os
import secrets
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent
ENV_FILE = ROOT / ".env"
ENV_EXAMPLE_FILE = ROOT / ".env.example"
RUNTIME_ENV_FILE = ROOT / ".queryforge.runtime.env"
START_TIMEOUT_SECONDS = 300
MIGRATION_TIMEOUT_SECONDS = 180
START_SERVICES = ("postgres", "redis", "backend")
FRONTEND_SERVICE = "frontend"
HOST_PORT_DEFAULTS = {
    "QUERYFORGE_HTTP_PORT": "80",
    "QUERYFORGE_BACKEND_PORT": "8000",
    "QUERYFORGE_POSTGRES_PORT": "5432",
    "QUERYFORGE_REDIS_PORT": "6379",
}


def detect_compose_command() -> list[str]:
    docker_compose = shutil.which("docker-compose")
    if docker_compose:
        return [docker_compose]

    docker = shutil.which("docker")
    if docker:
        result = subprocess.run(
            [docker, "compose", "version"],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if result.returncode == 0:
            return [docker, "compose"]

    raise SystemExit(
        "Docker Compose was not found. Install either 'docker-compose' or the "
        "'docker compose' plugin, then run this file again."
    )


def run_compose(
    *args: str,
    env: dict[str, str] | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    command = [*detect_compose_command(), *args]
    return subprocess.run(
        command,
        cwd=ROOT,
        env=env,
        text=True,
        check=check,
    )


def load_env_lines() -> list[str]:
    if ENV_FILE.exists():
        return ENV_FILE.read_text(encoding="utf-8").splitlines()
    if ENV_EXAMPLE_FILE.exists():
        return ENV_EXAMPLE_FILE.read_text(encoding="utf-8").splitlines()
    return []


def write_env_lines(lines: list[str]) -> None:
    ENV_FILE.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def load_key_value_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key] = value
    return values


def write_key_value_file(path: Path, values: dict[str, str]) -> None:
    lines = [f"{key}={value}" for key, value in sorted(values.items())]
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def get_env_value(lines: list[str], key: str) -> str | None:
    prefix = f"{key}="
    for line in lines:
        if line.startswith(prefix):
            return line[len(prefix):]
    return None


def set_env_value(lines: list[str], key: str, value: str) -> None:
    prefix = f"{key}="
    for index, line in enumerate(lines):
        if line.startswith(prefix):
            lines[index] = f"{key}={value}"
            return
    if lines and lines[-1] != "":
        lines.append("")
    lines.append(f"{key}={value}")


def ensure_env_file() -> None:
    lines = load_env_lines()
    changed = not ENV_FILE.exists()

    jwt_secret = get_env_value(lines, "JWT_SECRET")
    if not jwt_secret or jwt_secret == "change-me-in-production":
        set_env_value(lines, "JWT_SECRET", secrets.token_urlsafe(48))
        changed = True

    if get_env_value(lines, "OPENROUTER_API_KEY") is None:
        set_env_value(lines, "OPENROUTER_API_KEY", "")
        changed = True

    if get_env_value(lines, "LLM_MODEL") is None:
        set_env_value(lines, "LLM_MODEL", "anthropic/claude-sonnet-4-20250514")
        changed = True

    if changed:
        write_env_lines(lines)
        print(f"Prepared {ENV_FILE.name}")

    openrouter_key = get_env_value(lines, "OPENROUTER_API_KEY")
    if not openrouter_key:
        print(
            "Warning: OPENROUTER_API_KEY is empty in .env. The app will start, "
            "but prompt-generation features will fail until you set that key."
        )


def port_is_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def pick_host_port(preferred_port: str) -> str:
    preferred = int(preferred_port)
    if not port_is_in_use(preferred):
        return preferred_port

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return str(sock.getsockname()[1])


def get_compose_env(*, for_start: bool) -> dict[str, str]:
    env = os.environ.copy()
    runtime_values = load_key_value_file(RUNTIME_ENV_FILE)

    if for_start and not runtime_values:
        runtime_values = {
            key: env.get(key) or pick_host_port(default)
            for key, default in HOST_PORT_DEFAULTS.items()
        }
        write_key_value_file(RUNTIME_ENV_FILE, runtime_values)

    for key, default in HOST_PORT_DEFAULTS.items():
        env[key] = env.get(key) or runtime_values.get(key) or default

    return env


def format_base_url(http_port: str) -> str:
    if http_port == "80":
        return "http://127.0.0.1"
    return f"http://127.0.0.1:{http_port}"


def format_share_url(ip_address: str, http_port: str) -> str:
    if http_port == "80":
        return f"http://{ip_address}"
    return f"http://{ip_address}:{http_port}"


def run_migrations() -> None:
    compose_env = get_compose_env(for_start=False)
    deadline = time.time() + MIGRATION_TIMEOUT_SECONDS
    while time.time() < deadline:
        result = run_compose(
            "exec",
            "-T",
            "backend",
            "alembic",
            "upgrade",
            "head",
            env=compose_env,
            check=False,
        )
        if result.returncode == 0:
            return
        print("Waiting for backend container before retrying migrations...")
        time.sleep(5)

    raise SystemExit("Backend did not become ready for database migrations in time.")


def wait_for_http_health() -> None:
    compose_env = get_compose_env(for_start=False)
    health_url = f"{format_base_url(compose_env['QUERYFORGE_HTTP_PORT'])}/api/health"
    deadline = time.time() + START_TIMEOUT_SECONDS
    while time.time() < deadline:
        try:
            with urlopen(health_url, timeout=5) as response:
                if 200 <= response.status < 300:
                    return
        except (HTTPError, URLError, TimeoutError):
            time.sleep(2)
    raise SystemExit(
        "The HTTP server did not become healthy in time. Run "
        f"'python3 {Path(__file__).name} logs' to inspect the stack."
    )


def get_lan_ip() -> str | None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            ip_address = sock.getsockname()[0]
        if ip_address and not ip_address.startswith("127."):
            return ip_address
    except OSError:
        return None
    return None


def start_stack() -> None:
    ensure_env_file()
    compose_env = get_compose_env(for_start=True)

    print("Cleaning up any stale QueryForge containers...")
    run_compose("down", "--remove-orphans", env=compose_env, check=False)

    print("Starting database, cache, and backend containers...")
    run_compose("up", "-d", "--build", *START_SERVICES, env=compose_env)

    print("Running database migrations...")
    run_migrations()

    print("Starting frontend container...")
    run_compose("up", "-d", "--build", FRONTEND_SERVICE, env=compose_env)

    print("Waiting for the HTTP server to become healthy...")
    wait_for_http_health()

    lan_ip = get_lan_ip()
    http_port = compose_env["QUERYFORGE_HTTP_PORT"]
    local_url = format_base_url(http_port)
    health_url = f"{local_url}/api/health"
    print("\nQueryForge is running.")
    print(f"Local URL:  {local_url}")
    if lan_ip:
        print(f"Share URL:  {format_share_url(lan_ip, http_port)}")
    print(f"Health URL: {health_url}")
    print(f"Stop it with: python3 {Path(__file__).name} stop")


def stop_stack() -> None:
    run_compose("down", env=get_compose_env(for_start=False))


def show_status() -> None:
    run_compose("ps", env=get_compose_env(for_start=False))


def show_logs() -> None:
    run_compose("logs", "--tail=200", env=get_compose_env(for_start=False))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Start or manage the full Prompt BI HTTP stack."
    )
    parser.add_argument(
        "command",
        nargs="?",
        default="start",
        choices=("start", "stop", "status", "logs"),
        help="Stack action to run.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        if args.command == "start":
            start_stack()
        elif args.command == "stop":
            stop_stack()
        elif args.command == "status":
            show_status()
        else:
            show_logs()
    except subprocess.CalledProcessError as error:
        raise SystemExit(error.returncode) from error

    return 0


if __name__ == "__main__":
    sys.exit(main())

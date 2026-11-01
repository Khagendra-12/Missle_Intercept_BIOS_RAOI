import argparse

import uvicorn


def parse_args():
    parser = argparse.ArgumentParser(
        description="Run the EW layered-world simulation API."
    )

    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host address to bind to (default: 127.0.0.1).",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to bind to (default: 8000).",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable automatic reload during development.",
    )

    return parser.parse_args()


def main():
    args = parse_args()

    if not 1 <= args.port <= 65535:
        raise SystemExit("Error: port must be between 1 and 65535.")

    uvicorn.run(
        "ewsim.api:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )


if __name__ == "__main__":
    main()
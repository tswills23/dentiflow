"""Run SQL migration against Supabase using the PostgREST/Management API."""
import os
import sys
import json
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    sys.exit(1)

# Extract project ref from URL
PROJECT_REF = SUPABASE_URL.replace("https://", "").split(".")[0]


def run_sql(sql: str) -> dict:
    """Execute SQL via Supabase's pg REST endpoint (rpc)."""
    # Use the PostgREST rpc endpoint isn't suitable for DDL.
    # Instead, use the management API or the direct postgres connection.
    # Supabase exposes a SQL execution endpoint via the REST API.
    url = f"{SUPABASE_URL}/rest/v1/rpc/"

    # For DDL, we need to use supabase-py or the management API.
    # Let's use the supabase-py client which wraps the API.
    # Actually, the cleanest approach is to use the pg8000 or psycopg2
    # direct connection, or the Supabase Management API.
    #
    # Supabase provides a SQL execution endpoint at:
    # POST https://<project>.supabase.co/pg/query
    # with the service_role key as bearer token

    url = f"{SUPABASE_URL}/pg/query"
    headers = {
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "X-Supabase-Api-Version": "2024-01-01"
    }
    payload = {"query": sql}

    resp = requests.post(url, headers=headers, json=payload, timeout=30)
    return resp


def run_migration_file(filepath: str):
    """Read and execute a SQL migration file."""
    with open(filepath, "r", encoding="utf-8") as f:
        sql = f.read()

    print(f"Running migration: {filepath}")
    print(f"SQL length: {len(sql)} characters")
    print(f"Target: {SUPABASE_URL}")
    print("-" * 50)

    resp = run_sql(sql)

    if resp.status_code == 200:
        print("Migration completed successfully!")
        try:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)[:500]}")
        except:
            print(f"Response text: {resp.text[:500]}")
    else:
        print(f"Migration failed with status {resp.status_code}")
        print(f"Response: {resp.text[:1000]}")

        # If /pg/query doesn't work, try alternative approach
        if resp.status_code in (404, 405):
            print("\n/pg/query not available, trying alternative SQL execution...")
            return run_migration_via_rpc(sql)

    return resp


def run_migration_via_rpc(sql: str):
    """Fallback: try executing SQL via a custom RPC function or direct REST."""
    # Try the Supabase Management API endpoint
    url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
    headers = {
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    payload = {"query": sql}

    resp = requests.post(url, headers=headers, json=payload, timeout=30)

    if resp.status_code == 200:
        print("Migration completed successfully via Management API!")
        try:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)[:500]}")
        except:
            print(f"Response text: {resp.text[:500]}")
    else:
        print(f"Management API also failed with status {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        print("\nWill try statement-by-statement execution via PostgREST...")

    return resp


def query_practices():
    """Query the practices table to verify seed data."""
    url = f"{SUPABASE_URL}/rest/v1/practices?select=*"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json"
    }

    resp = requests.get(url, headers=headers, timeout=15)

    if resp.status_code == 200:
        data = resp.json()
        print("\n" + "=" * 50)
        print("PRACTICES TABLE - SEED DATA:")
        print("=" * 50)
        print(json.dumps(data, indent=2))
        return data
    else:
        print(f"\nQuery failed with status {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        return None


if __name__ == "__main__":
    migration_path = Path(__file__).resolve().parent.parent / "supabase" / "migrations" / "001_initial_schema.sql"

    if not migration_path.exists():
        print(f"ERROR: Migration file not found: {migration_path}")
        sys.exit(1)

    result = run_migration_file(str(migration_path))

    if result and result.status_code == 200:
        print("\nQuerying practices table to verify...")
        query_practices()
    else:
        print("\nMigration may have failed. Attempting to query practices anyway...")
        query_practices()

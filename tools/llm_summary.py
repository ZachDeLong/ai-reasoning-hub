import os, json
try:
    import requests
except ImportError:  # optional dependency (needed for ollama)
    requests = None
try:
    from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
except ImportError:  # graceful fallback if tenacity is unavailable
    def retry(*args, **kwargs):
        def decorator(fn):
            return fn
        return decorator

    def wait_exponential(*args, **kwargs):
        return None

    def stop_after_attempt(*args, **kwargs):
        return None

    def retry_if_exception_type(*args, **kwargs):
        return None

PROVIDER = os.getenv("SUMMARY_PROVIDER", "openai").lower()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

# Import OpenAI error types at module scope (safe even if provider != openai)
try:
    from openai import OpenAI, APIError, RateLimitError, InternalServerError
except Exception:
    # not required unless PROVIDER == openai, so ignore import errors
    OpenAI = None
    APIError = RateLimitError = InternalServerError = Exception

@retry(
    wait=wait_exponential(multiplier=2, min=5, max=90),
    stop=stop_after_attempt(8),
    retry=retry_if_exception_type((RateLimitError, APIError, InternalServerError)),
)
def call_llm(prompt: str):
    if PROVIDER == "openai":
        if OpenAI is not None:
            client = OpenAI()  # uses OPENAI_API_KEY from env
            resp = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "You are a precise research summarizer."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                max_tokens=2000,
            )
            text = resp.choices[0].message.content
            total_tokens = resp.usage.total_tokens if resp.usage else None
            return {"text": text, "tokens": total_tokens, "model": OPENAI_MODEL}
        else:
            return _call_openai_via_http(prompt)

    elif PROVIDER == "anthropic":
        from anthropic import Anthropic
        client = Anthropic()
        msg = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=2000,  # Increased here too
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(part.text for part in msg.content)
        return {"text": text, "tokens": None, "model": ANTHROPIC_MODEL}

    elif PROVIDER == "ollama":
        if requests is None:
            raise RuntimeError("requests library is required for SUMMARY_PROVIDER=ollama")
        r = requests.post(
            "http://localhost:11434/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {"temperature": 0.2},
            },
            timeout=120,
        )
        r.raise_for_status()
        data = r.json()
        text = data.get("message", {}).get("content", "")
        return {"text": text, "tokens": None, "model": OLLAMA_MODEL}

    else:
        raise RuntimeError(f"Unknown SUMMARY_PROVIDER: {PROVIDER}")


def _call_openai_via_http(prompt: str):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": "You are a precise research summarizer."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 2000,
    }
    if requests is not None:
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            json=payload,
            headers=headers,
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
    else:
        import urllib.request
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as resp_handle:
            body = resp_handle.read()
            data = json.loads(body.decode("utf-8"))
    choice = data.get("choices", [{}])[0]
    message = choice.get("message", {})
    text = message.get("content", "")
    total_tokens = (data.get("usage") or {}).get("total_tokens")
    return {"text": text, "tokens": total_tokens, "model": OPENAI_MODEL}

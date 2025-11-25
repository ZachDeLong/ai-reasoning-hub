import requests
import sys

def test_fetch(arxiv_id):
    url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
    print(f"Testing fetch for {url}...")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        resp = requests.get(url, timeout=15, headers=headers)
        print(f"Status Code: {resp.status_code}")
        print(f"Content Type: {resp.headers.get('Content-Type')}")
        print(f"Content Length: {len(resp.content)} bytes")
        
        if resp.status_code == 200 and 'application/pdf' in resp.headers.get('Content-Type', ''):
            print("SUCCESS: PDF fetched successfully.")
        else:
            print("FAILURE: Did not get a PDF.")
            print(f"Response headers: {resp.headers}")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    # Use one of the IDs found in the DB
    test_fetch("2510.17950")

"""Diagnostic: test WebSocket + curl in one script."""
import asyncio
import websockets
import json
import subprocess

async def test():
    uri = "ws://localhost:8000/ws"
    try:
        async with websockets.connect(uri) as ws:
            print("STEP 1: WS CONNECTED = YES")
            
            # Read initial stats_update
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(msg)
                print(f"STEP 1: Initial message type={data['type']} total_requests={data['data'].get('total_requests')}")
            except asyncio.TimeoutError:
                print("STEP 1: FAIL — no initial stats_update received within 5s")
                return
            
            print("STEP 1: Sending curl request...")
            proc = subprocess.run(
                ["curl", "-s", "-X", "POST", "http://localhost:8000/route",
                 "-H", "Content-Type: application/json",
                 "-d", '{"text": "test realtime diagnostic"}'],
                capture_output=True, text=True, timeout=30
            )
            curl_data = json.loads(proc.stdout)
            print(f"STEP 1: CURL OK — {curl_data['complexity']} -> {curl_data['model_used']}")
            
            # Wait for broadcast messages
            messages = []
            for i in range(3):
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5)
                    data = json.loads(msg)
                    messages.append(data)
                    print(f"STEP 1: WS MESSAGE #{i+1} type={data['type']}")
                    if data['type'] == 'new_request':
                        d = data['data']
                        print(f"  model={d.get('model_used')} complexity={d.get('complexity')} savings={d.get('savings')}")
                    elif data['type'] == 'stats_update':
                        d = data['data']
                        print(f"  total_requests={d.get('total_requests')} total_savings={d.get('total_savings')}")
                except asyncio.TimeoutError:
                    break
            
            if not messages:
                print("STEP 1: FAIL — no broadcast messages received after curl")
            else:
                print(f"STEP 1: PASS — received {len(messages)} broadcast messages")
            
            # Check stats object identity
            print("\nSTEP 2: Checking stats object structure...")
            types = [m['type'] for m in messages]
            print(f"  Message types received: {types}")
            stats_msgs = [m for m in messages if m['type'] == 'stats_update']
            if stats_msgs:
                s = stats_msgs[-1]['data']
                print(f"  Stats keys: {list(s.keys())}")
                print(f"  total_requests={s.get('total_requests')}")
                print(f"  total_savings={s.get('total_savings')}")
                print(f"  total_savings_percentage={s.get('total_savings_percentage')}")
                print(f"  avg_latency_ms={s.get('avg_latency_ms')}")
                print(f"  routing_distribution={s.get('routing_distribution')}")
            
            new_req = [m for m in messages if m['type'] == 'new_request']
            if new_req:
                r = new_req[0]['data']
                print(f"\n  new_request keys: {list(r.keys())}")
                print(f"  Has timestamp? {'timestamp' in r}")
            
    except Exception as e:
        print(f"STEP 1: CONNECTION FAILED — {e}")

asyncio.run(test())

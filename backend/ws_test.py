"""Diagnostic: test WebSocket message delivery."""
import asyncio
import websockets
import json

async def test():
    uri = "ws://localhost:8000/ws"
    async with websockets.connect(uri) as ws:
        print("WS CONNECTED")
        # Read the initial stats_update sent on connect
        msg = await asyncio.wait_for(ws.recv(), timeout=5)
        data = json.loads(msg)
        tr = data["data"].get("total_requests")
        print(f"INITIAL MESSAGE type={data['type']} total_requests={tr}")
        # Now wait for broadcast triggered by curl
        print("Waiting for next WS message (send curl now)...")
        try:
            msg2 = await asyncio.wait_for(ws.recv(), timeout=20)
            data2 = json.loads(msg2)
            print(f"GOT MESSAGE type={data2['type']}")
            if data2["type"] == "new_request":
                d = data2["data"]
                print(f"  model={d.get('model_used')} complexity={d.get('complexity')}")
            elif data2["type"] == "stats_update":
                d = data2["data"]
                print(f"  total_requests={d.get('total_requests')} total_savings={d.get('total_savings')}")
            # Try second broadcast
            msg3 = await asyncio.wait_for(ws.recv(), timeout=5)
            data3 = json.loads(msg3)
            print(f"GOT MESSAGE type={data3['type']}")
            if data3["type"] == "stats_update":
                d = data3["data"]
                print(f"  total_requests={d.get('total_requests')} total_savings={d.get('total_savings')}")
        except asyncio.TimeoutError:
            print("TIMEOUT — no message received")

asyncio.run(test())

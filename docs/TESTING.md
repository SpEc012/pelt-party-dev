# Device test checklist

## iPhone 14 Safari

1. Open the deployed URL in a private tab. No login should appear.
2. Tap PLAY, then START MATCH. An eight-player match should reach its four-second countdown and begin within ten seconds.
3. Use the left side to move and drag the right side to look. Tap THROW; hold it for a Big Pelt and check it spends two ammo.
4. DIVE twice and check the charges recharge. Hold SCOOP to pack ammo; stand on a glowing pile to refill. Tap WALL and hide behind it. Walk onto a power-up pad.
5. Rotate to landscape and back. No action should remain stuck down. Background the tab and return.
6. Finish a match and use the results buttons. Practice coins should persist after refreshing. Buy a hat and see it on the original chibi.
7. Open Settings, enable Show FPS. Record FPS, draw calls and triangles after five minutes, with the phone model, iOS version, quality tier and thermal condition. Emulation is not evidence of 60 fps here.
8. Switch to Frost with the season chip and use Play the Halloween Edition to return.

## Phone plus laptop

1. Create a private room on one device. Join on the other with the displayed four-character code.
2. Confirm names/characters and the same roster. Start now. Both should show the same countdown and timer.
3. Move and throw on both. Record RTT/jitter from debug. Check scores/hearts agree after a hit.
4. Turn one device's network off for two seconds, then on. It should rejoin the same seat. Refresh during the match.
5. Open the same browser profile in a second tab. The old tab should explain that the new one took over.
6. Have the host leave. The room should continue and elect a connected human host.
7. Try a bad room code and a duplicate nickname. Recover through the menu; no blank page.
8. Open Quick Play alone. After twenty seconds, choose Fill with bots. With several humans, a strict majority must opt in.

## Before calling this contest-ready

Run all automated tests and the full edge-case list from the brief. Add real cross-network testing, iPhone Safari/WebKit checks, busy-match bandwidth, host restart recovery, sustained memory/queue measurements, and a public deployment rollback rehearsal. The current early build does not satisfy every item yet.

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const videoElement = document.getElementById('video-loopback');

  try {
    const cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    });

    const pc = new RTCPeerConnection({
      sdpSemantics: 'unified-plan'
    });

    cameraStream.getTracks().forEach((track) =>
      pc.addTransceiver(track, {
        direction: 'sendrecv',
        streams: [cameraStream]
      })
    );

    pc.addEventListener('track', (event) => {
      const [stream] = event.streams;
      videoElement.srcObject = stream;
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const response = await fetch('/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: pc.localDescription.sdp
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const answer = await response.json();
    await pc.setRemoteDescription(answer);

    window.setInterval(() => {
      displayLocalStats(pc);
      displayServerStats(answer.username);
    }, 1000);
  } catch (error) {
    console.error(error);
  }
});

function displayLocalStats(pc) {
  pc.getStats(null).then((stats) => {
    let statsOutput = '';

    stats.forEach((report) => {
      statsOutput +=
        `<h2>Report: ${report.type}</h2>\n<strong>ID:</strong> ${report.id}<br>\n` +
        `<strong>Timestamp:</strong> ${report.timestamp}<br>\n`;

      // Now the statistics for this report; we intentially drop the ones we
      // sorted to the top above

      Object.keys(report).forEach((statName) => {
        if (
          statName !== 'id' &&
          statName !== 'timestamp' &&
          statName !== 'type'
        ) {
          statsOutput += `<strong>${statName}:</strong> ${report[statName]}<br>\n`;
        }
      });
    });

    const connectionStats = {
      signalingState: pc.signalingState,
      iceGatheringState: pc.iceGatheringState,
      iceConnectionState: pc.iceConnectionState,
      configuration: pc.getConfiguration()
    };

    statsOutput =
      `<h2>RTCPeerConnection Stats</h2>\n<code><pre>${JSON.stringify(
        connectionStats,
        null,
        '  '
      )}</pre></code>\n` + statsOutput;

    document.getElementById('local-stats').innerHTML = statsOutput;
  });
}

async function displayServerStats(username) {
  const serverStatsElement = document.getElementById('server-stats');

  try {
    const response = await fetch(`/stats?username=${username}`);
    if (!response.ok) {
      if (response.status === 404) {
        serverStatsElement.innerHTML = 'Server disconnected';
        return;
      } else {
        throw new Error(`${response.status} ${response.statusText}`);
      }
    }
    const serverStats = await response.json();

    const statsOutput = `<code><pre>${JSON.stringify(
      serverStats,
      null,
      '  '
    )}</pre></code>\n`;

    serverStatsElement.innerHTML = statsOutput;
  } catch (error) {
    console.error(error);
  }
}

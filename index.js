const internalIp = require('internal-ip');
const MediaServer = require('medooze-media-server');
const { SDPInfo } = require('semantic-sdp');
const express = require('express');

MediaServer.enableLog(true);
MediaServer.enableDebug(true);
MediaServer.enableUltraDebug(false);

const ip = process.env.IP_ADDRESS || internalIp.v4.sync();
const endpoint = MediaServer.createEndpoint(ip);

const app = express();
app.use(express.static('public'));
app.use(express.text());

const allTransports = new Map();

app.post('/connect', (req, res, next) => {
  const offer = SDPInfo.parse(req.body);

  const transport = endpoint.createTransport(offer);
  transport.setRemoteProperties(offer);

  const answer = offer.answer({
    dtls: transport.getLocalDTLSInfo(),
    ice: transport.getLocalICEInfo(),
    candidates: transport.getLocalCandidates(),
    capabilities: MediaServer.getDefaultCapabilities()
  });
  transport.setLocalProperties(answer);

  const incomingStream = transport.createIncomingStream(offer.getFirstStream());
  const outgoingStream = transport.createOutgoingStream({
    audio: false,
    video: true
  });
  outgoingStream.attachTo(incomingStream);
  answer.addStream(outgoingStream.getStreamInfo());

  res.json({
    username: transport.username,
    type: 'answer',
    sdp: answer.toString()
  });

  allTransports.set(transport.username, transport);
});

app.get('/stats', (req, res, next) => {
  const transport = allTransports.get(req.query.username);

  if (!transport) {
    res.status(404).end();
  } else {
    res.json({
      transport: {
        DTLSState: transport.getDTLSSatate(),
        stats: transport.getStats()
      }
    });
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on ${ip}:${listener.address().port}`);
});

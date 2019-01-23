import EMEController from '../../../src/controller/eme-controller';
import HlsMock from '../../mocks/hls.mock';
import EventEmitter from 'events';
import { ErrorTypes, ErrorDetails } from '../../../src/errors';

import assert from 'assert';
const sinon = require('sinon');

const MediaMock = function () {
  let media = new EventEmitter();
  media.setMediaKeys = sinon.spy();
  media.addEventListener = media.addListener.bind(media);
  return media;
};

const fakeLevels = [
  {
    audioCodec: 'audio/foo'
  },
  {
    videoCoded: 'video/foo'
  }
];

let emeController;
let media;

const setupEach = function (config) {
  media = new MediaMock();

  emeController = new EMEController(new HlsMock(config));
};

describe('EMEController', () => {
  beforeEach(() => {
    setupEach();
  });

  it('should be constructable with an unconfigured Hls.js instance', () => {});

  it('should trigger key system error when bad encrypted data is received', (done) => {
    let reqMediaKsAccessSpy = sinon.spy(() => {
      return Promise.resolve({
        // Media-keys mock
      });
    });

    setupEach({
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy,
      drmSystem: 'WIDEVINE'
    });

    let badData = {
      initDataType: 'cenc',
      initData: 'bad data'
    };

    emeController.onMediaAttached({ media });
    emeController.onManifestParsed({ levels: fakeLevels });

    media.emit('encrypted', badData);

    setTimeout(() => {
      assert.equal(emeController.hls.trigger.args[0][1].details, ErrorDetails.KEY_SYSTEM_NO_KEYS);
      assert.equal(emeController.hls.trigger.args[1][1].details, ErrorDetails.KEY_SYSTEM_NO_ACCESS);
      done();
    }, 0);
  });

  it('should retrieve PSSH data if it exists in manifest', (done) => {
    let reqMediaKsAccessSpy = sinon.spy(() => {
      return Promise.resolve({
        // Media-keys mock
      });
    });

    setupEach({
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy,
      drmSystem: 'WIDEVINE'
    });

    const data = {
      frag: {
        foundKeys: true,
        drmInfo: [{
          format: 'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed',
          reluri: 'data:text/plain;base64,AAAAPnBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB4iFnNoYWthX2NlYzJmNjRhYTc4OTBhMTFI49yVmwY='
        }]
      }
    };

    emeController.onMediaAttached({ media });
    emeController.onManifestParsed({ levels: fakeLevels });
    emeController.onFragLoaded(data);

    media.emit('encrypted', {
      'initDataType': emeController._initDataType,
      'initData': emeController._initData
    });

    assert.equal(emeController._initDataType, 'cenc');
    assert.equal(62, emeController._initData.byteLength);

    setTimeout(() => {
      assert.equal(emeController._isMediaEncrypted, true);
      done();
    }, 0);
  });
});

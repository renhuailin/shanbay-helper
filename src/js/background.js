function getOuterHTML(e) {
  return e.length > 0 ? e[0].outerHTML : undefined;
}

function getInnerHTML(e) {
  return e.length > 0 ? e[0].innerHTML : undefined;
}

window.__shanbayExtensionAuthInfo = {
  user: null,
  checkAuth (callback) {
    chrome.cookies.getAll({url: 'https://www.shanbay.com'}, cookies => {
      this.user = (cookies.find(cookie => cookie.name === 'userid') || {}).value;
      const auth_token = (cookies.find(cookie => cookie.name === 'auth_token') || {}).value;
      callback(auth_token && auth_token.length > 0)
    })
  }
};

/*=====================使用web音频接口播放音频的方法==================*/
const playSound = url => {
  const context = new AudioContext();
  request(url, {type: 'buffer'}).then(r => {
    context.decodeAudioData(r, function (buffer) {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start(0)
    })
  })
};
/*=================================================================*/

chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
  switch (req.action) {
    case 'collins':
      $.get(`https://dict.youdao.com/w/eng/${word}`, (data) => {
        const doc = $('<div></div>');
        doc.html(data);
        const res = {};
        res.collins = getOuterHTML(doc.find('#collinsResult').find('.ol'));
        res.rank = getInnerHTML(doc.find('span.via.rank'));
        res.extra = [
          { name: "词组短语", html: getOuterHTML(doc.find('#wordGroup')) },
          { name: "同近义词", html: getOuterHTML(doc.find('#synonyms')) },
          { name: "同根词", html: getOuterHTML(doc.find('#relWordTab')) },
          { name: "词语辨析", html: getOuterHTML(doc.find('#discriminate')) },
        ];
        console.log(res);
        sendResponse(res);
      });
      return true;
    case 'wordsmyth':
      $.get(`https://www.wordsmyth.net/?ent=${word}`, (data) => {
        const doc = $('<div></div>');
        doc.html(data);
        const res = {};
        res.syllabification = getInnerHTML(doc.find('.headword.syl'));
        console.log(res);
        sendResponse(res);
      });
      return true;
    case 'lookup':
      lookUp(req.word).then(res => {
        chrome.tabs.sendMessage(sender.tab.id, {'action': 'lookup', data: res})
      });
      break;
    case 'addWord':
      addWord(req.id).then(res => {
        chrome.tabs.sendMessage(sender.tab.id, {'action': 'addWord', data: res})
      });
      break;
    case 'forgetWord':
      forget(req.learningId).then(res => {
        chrome.tabs.sendMessage(sender.tab.id, {'action': 'forgetWord', data: res})
      });
      break;
    case 'playSound':
      playSound(req.url);
      break;
    default:
      throw Error('Invalid action type')
  }
});

let taskTimer;

const getDailyTask = () => {
  /**
   * 每3小时检测一下今天的剩余单词数量, 必须登录扇贝之后才可以使用
   * @function getDailyTask
   * */
  if (storage.alarm) {
    taskTimer = setInterval(function () {
      if (!storage.alarm) return clearInterval(taskTimer);
      debugLogger('log', 'send daily task request');
      request('https://www.shanbay.com/api/v1/bdc/stats/today/').then(r => {

        if (r.data.num_left === 0) {
          chrome.browserAction.setBadgeText({text: ''})
        } else {
          chrome.browserAction.setBadgeText({text: r.data.num_left + ''});
          notify({
            message: `今天还有${r.data.num_left}个单词需要复习`,
            url: 'https://www.shanbay.com/bdc/review/'
          })
        }
      }).catch(e => debugLogger('error', 'get daily task failed, cause: ', e))
    }, 1000 * 60 * 60 * 3)
  } else {
    if (taskTimer) clearInterval(taskTimer)
  }
};

chrome.storage.onChanged.addListener(changes => {
  const settings = changes.__shanbayExtensionSettings.newValue;
  if (Object.keys(settings).length) {
    settings.forEach(item => {
      Object.assign(storage, item)
    })
  }
  getDailyTask()
});

chrome.storage.sync.get('__shanbayExtensionSettings', (settings) => {
  if (Object.keys(settings).length) {
    settings.__shanbayExtensionSettings.forEach(item => {
      Object.assign(storage, item)
    })
  } else {
    storage = storageSettingMap
  }

  // contentMenu
  chrome.contextMenus.removeAll(function () {
    if (storage.contextLookup) {
      debugLogger('info', 'contextMenu added');
      chrome.contextMenus.create({
        title: '在扇贝网中查找 %s',
        contexts: ['selection'],
        onclick: function (info, tab) {
          lookUp(info.selectionText).then(res => {
            chrome.tabs.sendMessage(tab.id, {'action': 'lookup', data: res})
          })
        }
      })
    }
  });
  getDailyTask()
});

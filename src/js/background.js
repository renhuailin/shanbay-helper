
let g_db; //global indexedDB instance.

var request = window.indexedDB.open("shanbay_plus");
request.onerror = function (event) {
  //alert("Why didn't you allow my web app to use IndexedDB?!");
  console.log(event);
};
request.onsuccess = function (event) {
  g_db = event.target.result;
};
request.onupgradeneeded = function (event) {
  // 更新对象存储空间和索引 .... 
  var db = event.target.result;
  var objectStore = db.createObjectStore("vocabulary", { keyPath: "word" });
  objectStore.createIndex("time", "time", { unique: false });
}


// find the <word> from local indexedDB
function getVocabularyViaDB(word, callback) {
  var viaWeb = function () {
    getVocabularyViaWeb(word, function (resp, store) {
      if (store) {
        // store via sql
        g_db.transaction(["vocabulary"], "readwrite").objectStore("vocabulary").put({
          word: word,
          content: resp,
          time: new Date().getTime()
        });
      }
      callback(resp, store);
    });
  }

  var result = g_db.transaction(["vocabulary"]).objectStore("vocabulary").get(word);

  result.onsuccess = function (event) {
    if (typeof event.target.result != 'undefined') {
      // 过期检查
      if (new Date().getTime() - event.target.result.time < DB_EXPIRE) {
        callback(event.target.result.content, true);
        return;
      }
    }
    viaWeb();
  };
  result.onerror = function (event) {
    viaWeb();
  };
  return;
  // if get via db
}








function getOuterHTML(e) {
  return e.length > 0 ? e[0].outerHTML : undefined;
}

function getInnerHTML(e) {
  return e.length > 0 ? e[0].innerHTML : undefined;
}


const devMode = !('update_url' in chrome.runtime.getManifest());

const debugLogger = (level = 'log', ...msg) => {
  if (devMode) console[level](...msg)
};

chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
  debugLogger('log', req);
  switch (req.action) {
    case 'collins':
      console.log("Fetch youdao.com")
      // $.get(`https://dict.youdao.com/w/eng/${req.word}`, (data) => {
      fetch(`https://dict.youdao.com/w/eng/${req.word}`).then(response => response.text()).then((data) => {
        console.log(data);
        // const doc = $('<div></div>');
        const doc = document.createElement('div');
        doc.innerHTML = data;
        // doc.html(data);
        const res = {};
        // res.collins = getOuterHTML(doc.find('#collinsResult').find('.ol'));
        res.collins = doc.querySelector('#collinsResult').querySelector('.ol').outerHTML;

        // res.rank = getInnerHTML(doc.find('span.via.rank'));
        // res.extra = [
        //   { name: "词组短语", html: getInnerHTML(doc.find('#wordGroup')) },
        //   { name: "同近义词", html: getInnerHTML(doc.find('#synonyms')) },
        //   { name: "同根词", html: getInnerHTML(doc.find('#relWordTab')) },
        //   { name: "词语辨析", html: getInnerHTML(doc.find('#discriminate')) },
        // ];

        debugLogger('log', res);
        sendResponse(res);
      }).catch((error) => {
        console.error('Error:', error);
      });

      return true;





    case 'wordsmyth':
      console.log("Fetch wordsmyth.net")
      $.get(`https://www.wordsmyth.net/?ent=${req.word}`, (data) => {
        const doc = $('<div></div>');
        doc.html(data);
        const res = {};
        res.syllabification = getInnerHTML(doc.find('.headword.syl'));
        debugLogger('log', res);
        sendResponse(res);
      });
      return true;
    default:
      throw Error('Invalid action type')
  }
});

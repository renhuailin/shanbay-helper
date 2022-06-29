function sideBar(response) {
  const main = document.querySelector('.span12');
  main.setAttribute('class', main.className.replace("span12", "span8"));
  main.setAttribute('style', '');
  const side = document.createElement('div');
  side.setAttribute('class', 'span4');
  side.setAttribute('id', 'sidebar');
  let sideHTML = "";
  response.extra.forEach((x) => {
    if (x.html) {
      sideHTML += `
            <div class="sidebar-block">
              <div class="sidebar-content">
                <b>${x.name}</b>
                ${x.html}
              </div>
            </div>
          `
    }
  });
  side.innerHTML = sideHTML;
  main.parentElement.appendChild(side);
}

function rank(response) {
  if (!response.rank) return;
  const tab = document.querySelector("div[class^=index_switch]");
  tab.appendChild(document.createTextNode(response.rank));
}

function mergeNotes() {
  const s1 = $("div[class^='index_UserNotesWrap']").parent();
  const s2 = $("div[class^='index_myNotesWrap']").parent();
  if (s1.length > 0) {
    s2.removeAttr('class');
    $(s2).after($(s1));
  }
}

let g_db; //global indexedDB instance.
let g_fetching = false;
//Open indexedDB named shanbay_ding,if it doesn't exist ,create it.
var request = window.indexedDB.open("shanbay_ding");
request.onerror = function (event) {
  console.log(event);
};
request.onsuccess = function (event) {
  g_db = event.target.result;
};
request.onupgradeneeded = function (event) {
  // 更新对象存储空间和索引 .... 
  var db = event.target.result;
  var objectStore = db.createObjectStore("collins", { keyPath: "word" });
  objectStore.createIndex("time", "time", { unique: false });
}


function saveWordToIndexedDb(record) {
  g_db.transaction(["collins"], "readwrite").objectStore("collins").put({
    word: record['word'],
    meanings: record['meanings'],
    time: new Date().getTime()
  });
}

// find the <word> from local indexedDB
function findWordInIndexedDB(word) {
  return new Promise((resolve, reject) => {
    var result = g_db.transaction(["collins"]).objectStore("collins").get(word);

    result.onsuccess = function (event) {
      resolve(event.target.result)
    };
    result.onerror = function (event) {
      reject(event)
    };
  });
}

//Parse word meanings from HTMl return from dict.youdao.com
function paserYoudaoResult(youdaoHtml) {
  const doc = document.createElement('div');
  doc.innerHTML = youdaoHtml;
  const collinsItem = {};
  collinsItem.meanings = doc.querySelector('#collinsResult').querySelector('.ol').outerHTML;
  // res.rank = getInnerHTML(doc.find('span.via.rank'));
  // res.extra = [
  //   { name: "词组短语", html: getInnerHTML(doc.find('#wordGroup')) },
  //   { name: "同近义词", html: getInnerHTML(doc.find('#synonyms')) },
  //   { name: "同根词", html: getInnerHTML(doc.find('#relWordTab')) },
  //   { name: "词语辨析", html: getInnerHTML(doc.find('#discriminate')) },
  // ];
  return collinsItem
}

setInterval(async () => {
  try {
    const ele = $("div[class^='BayTrans_paraphrase']");
    // if (ele.length > 0 && ele[0].parentElement.attributes["id"] === undefined) {
    if (ele.length > 0) {

      if (ele[0].parentElement.attributes["id"] === undefined || ele[0].parentElement.attributes["id"] !== 'collinsResult') {
        ele[0].parentElement.setAttribute('id', 'collinsResult');
      }
      const word = $("div[class^='VocabPronounce_word']")[0].innerText;

      if (!g_fetching) {
        let record = await findWordInIndexedDB(word)
        if (record !== undefined) {
          console.log(`Found the word ${word} in the local indexedDB`);
          ele.replaceWith(record.meanings);
          g_fetching = false
          return
        }

        console.log(`cannot find the word ${word} in local indexedDB,try to fetch it from web.`);
        // can not find this word in 'collins' table in local indexedDB,
        // so fetch it from dict.youdao.com
        g_fetching = true
        chrome.runtime.sendMessage({ action: 'collins', word }, (response) => {
          // console.log(response);
          if (response) {
            try {
              let collinsItem = paserYoudaoResult(response)
              collinsItem.word = word
              saveWordToIndexedDb(collinsItem)
              ele.replaceWith(collinsItem.meanings);
              // sideBar(response);
              // rank(response);
              // mergeNotes();
            } catch (error) {
              g_fetching = false
            }

          } else {
            console.log("invalid response!")
          }
          g_fetching = false
        });
      }

      // chrome.runtime.sendMessage({ action: 'wordsmyth', word }, (response) => {
      //   console.log(response);
      //   if (response.syllabification) {
      //     $("div[class^='VocabPronounce_word']").text(response.syllabification);
      //   }
      // });
    }
  } catch (error) {
    console.log(error)
  }
}, 300);

// 输入框元素和按钮元素
var inputBox = document.getElementById("inputBox");
var sendBtn = document.getElementById("sendBtn");
// 聊天容器元素
var chatContainer = document.getElementById("chatContainer");
// 滑动容器元素
var scrollable = document.getElementById("scrollable");
// 加载页面动画
var loaders = document.querySelectorAll(".loader");
// 腾讯存储桶
var cos = new COS({
    SecretId: 'AKIDSjkUxAAsJUmunQmrfCTTCdnnWy94oJYY',
    SecretKey: 'lGVVFjxve7KHzSfcKmytYy82g5D5h4B3',
});
var bucket = 'cos-1309300400';
var region = 'ap-beijing';
var keys = 'ChatRoom/ChatRecords.json';
// 随机昵称
var nickname = getOrCreateCookie('nickname', rand_nick());
//主页
var myhtml = "ChatRoom.html";
// 加载页面对应的脚本
const HtmlPage = window.location.href;
if (HtmlPage.includes(myhtml)) {
    // 消息数量
    var ListQuantity = 0;
    // 消息
    var ImplicitMessage;
    // 监听输入框内容变化事件
    inputBox.addEventListener("input", function(event) {
        // 如果输入框内容为空，设置按钮透明度为70%并禁用点击事件
        if (inputBox.value === "") {
            sendBtn.style.opacity = 0.7;
        } else {
            sendBtn.style.opacity = 1;
            var inputValue = event.target.value;
            var urlRegex = /(https?:\/\/[^\s]+)/g;
            var matches = inputValue.match(urlRegex);
            if (matches) {
                for (var i = 0; i < matches.length; i++) {
                    var url = matches[i];
                    if (!isLinkInTags(url, inputValue)) {
                      isImageLink(url).then(function(loaded) {
                        if (loaded) {
                            if (inputValue.indexOf('<img src="'+url+'"') === -1) {
                                inputValue = inputValue.replaceAll(url,"");
                                inputValue += '<img src="'+url+'" alt="Image">';
                                event.target.value = inputValue;
                            }
                        } else {
                            if (inputValue.indexOf('<a href="'+url+'"') === -1) {
                                inputValue = inputValue.replaceAll(url,"");
                                inputValue += '<a href="'+url+'" style="text-decoration:none" target="_blank">传送门</a>';
                                event.target.value = inputValue;
                            }
                        }
                      });
                    }
                }
            }
            if (inputValue === "℡") {
                event.target.value = "";
                window.location.href = "ClearChatRecords.html?isbool=true";
            }
        }
    });
    // 发送
    sendBtn.addEventListener('click', function() {
        var msg = inputBox.value;
        if (msg !== "") {
            // 创建用户发送的信息气泡
            SendsMessages(msg);
            // 清空输入框内容
            inputBox.value = "";
            // 重置按钮透明度和禁用状态
            sendBtn.style.opacity = 0.7;
        }else{
            toast("消息不能为空!");
        }
    });
    // 发送消息
    function SendsMessages(message) {
        if (message.trim().startsWith("@") && message.trim().endsWith("℡")) {
            setCookie(message);
        } else if (message.trim() === "💣") {
            cos.putObject({
                Bucket: bucket,
                Region: region,
                Key: keys,
                Body: '[]'
            }, function(err, data) {
                if (err) {
                    console.log(err);
                } else {
                    chatContainer.innerHTML = "";
                    toast("已清空聊天记录");
                }
            });
        } else {
            message = message.replaceAll("\\💣", "💣").replaceAll("\n", "<br>");
            cos.getObject({
                Bucket: bucket,
                Region: region,
                Key: keys
            }, function(err, data) {
                if (err) {
                    console.log(err);
                } else {
                    var json = [];
                    var messages2 = data.Body.toString();
                    try {
                        json = JSON.parse(messages2);
                    } catch (error) {
                        json = [];
                        console.log('无效的JSON格式或空列表');
                    }
                    var Time = GetTime();
                    var newData = {
                        "Name": nickname,
                        "Msg": message,
                        "Time": Time
                    };
                    json.push(newData);
                    if (json && Array.isArray(json)) {
                        cos.putObject({
                            Bucket: bucket,
                            Region: region,
                            Key: keys,
                            Body: JSON.stringify(json)
                        }, function(err, data) {
                            if (err){
                                toast("发送失败");
                              }else{
                                ListQuantity++;
                                LoadMyMessage(message ,Time);
                            }
                        });
                    }
                }
            });
        }
    }
    // 获取消息
    cos.getObject({
        Bucket: bucket,
        Region: region,
        Key: keys
    }, function(err, data) {
        if (err && err.statusCode === 404) {
            cos.putObject({
                Bucket: bucket,
                Region: region,
                Key: keys,
                Body: '[]'
            });
            cos.headBucket({
                Bucket: bucket,
                Region: region
            }, function(err, data) {
                if (err) {
                    inputBox.style.display = 'none';
                    sendBtn.style.display = 'none';
                    toast("聊天室不可用");
                    setInterval(function() {
                        toast("聊天室不可用");
                    }, 1000);
                    document.title = "网页无法打开";
                } else {
                    inputBox.style.display = 'block';
                    sendBtn.style.display = 'block';
                    setInterval(asyncOperation, 3000);
                }
            });
        } else if (!err) {
            var json;
            var messages = data.Body.toString();
            try {
                json = JSON.parse(messages);
            } catch (error) {
                console.log('无效的JSON格式或空列表');
            }
            if (json && Array.isArray(json)) {
                json.forEach(function(group) {
                    ListQuantity++;
                    if(group.Name !== "Cookie") {
                        if (group.Name === nickname) {
                            LoadMyMessage(group.Msg ,group.Time);
                        } else {
                            LoadUserMessages(group.Name, group.Msg, group.Time, true);
                        }
                    } else if (group.Name === "Cookie"){
                        UserTips(group.Msg);
                        scrollable.scrollTop = scrollable.scrollHeight;
                    }
                });
              inputBox.style.display = 'block';
              sendBtn.style.display = 'block';
              setInterval(asyncOperation, 3000);
            }
        } else {
            toast("聊天室不可用!");
            document.title = "网页无法打开";
        }
        DeleteLoaders();
    });
    // 加载我的消息
    function LoadMyMessage(msg, Time) {
        LoadTips(Time);
        var modifiedContent = msg.replace(/(<img.*?>)/gi, function(match, p1) {
          if (p1.indexOf('onclick') === -1) {
             return p1.replace(/(\/?>)/, ' onclick="openModal(this)"$1');
          } else {
            return match;
          }
        });
        msg=modifiedContent;
        var matches = msg.match(/@.*?⁩ /g);
        var OpeningText = "";
        if(matches!=null){
           for(var i=0; i<matches.length; i++) {
              msg = msg.replace(matches[i], "");
              OpeningText += matches[i];
           }
        }
        var userBubble = document.createElement("div");
        userBubble.classList.add("item2");
        userBubble.innerHTML = '<img class="image2" src="' + LetterAvatar(nickname, 1000) + '"><div class="text2-container2"><div class="text2">' + nickname.slice(0, -11) + '</div><div class="text2-red2" id="msg">' + msg + '</div></div>';
        chatContainer.appendChild(userBubble);
        var sss = userBubble.querySelector("#msg");
        sss.classList.add('ACRONYM',"text2-red2");
        sss.setAttribute('data-symbol', OpeningText);
        scrollable.scrollTop = scrollable.scrollHeight;
    }
    // 加载用户消息
    function LoadUserMessages(nick, msg, Time, bool) {
        LoadTips(Time);
        var modifiedContent = msg.replace(/(<img.*?>)/gi, function(match, p1) {
          if (p1.indexOf('onclick') === -1) {
             return p1.replace(/(\/?>)/, ' onclick="openModal(this)"$1');
          } else {
            return match;
          }
        });
        msg = modifiedContent;
        var matches = msg.match(/@.*?⁩ /g);
        var OpeningText = "";
        if(matches!=null){
           for(var i=0; i<matches.length; i++) {
              msg = msg.replace(matches[i], "");
              OpeningText += matches[i];
           }
        }
        var autoReplyBubble = document.createElement("div");
        autoReplyBubble.classList.add("item");
        autoReplyBubble.innerHTML = '<img class="image" id="HeadSculpture" src="' + LetterAvatar(nick, 1000) + '"><div class="text-container"><div class="text">' + nick.slice(0, -11) + '</div><div class="text-red" id="msg">' + msg + '</div></div>';
        chatContainer.appendChild(autoReplyBubble);
        var sss = autoReplyBubble.querySelector("#msg");
        sss.classList.add('ACRONYM',"text-red");
        sss.setAttribute('data-symbol', OpeningText);
        if(bool) scrollable.scrollTop = scrollable.scrollHeight;
        let timeoutId;
        autoReplyBubble.querySelector('#HeadSculpture').addEventListener('touchstart', () => {
           timeoutId = setTimeout(() => {
             appendTextAtBeginning("@" + nick.slice(0, -11) + "⁩ ");
           }, 300);
        });
        autoReplyBubble.querySelector('img').addEventListener('touchend', () => {
           clearTimeout(timeoutId);
        });
    }
    function appendTextAtBeginning(textToAppend) {
       let currentText = inputBox.value;
       let newText = textToAppend + currentText.replace(textToAppend,"");
       inputBox.value = newText;
    }
    // 放大图片
    function openModal(img) {
        var modal = document.getElementById("myModal");
        var modalImg = document.getElementById("modalImage");
        modal.style.display = "block";
        modalImg.src = img.src;
    }
    // 缩小图片
    function closeModal() {
        var modal = document.getElementById("myModal");
        modal.style.display = "none";
    }
    // 刷新消息
    function refreshMessage() {
        return new Promise(function(resolve, reject) {
            cos.getObject({
                Bucket: bucket,
                Region: region,
                Key: keys
            }, function(err, data) {
                if (err && err.statusCode === 404) {
                    cos.putObject({
                        Bucket: bucket,
                        Region: region,
                        Key: keys,
                        Body: '[]'
                    });
                } else if (!err) {
                    var json;
                    var messages = data.Body.toString();
                    try {
                        json = JSON.parse(messages);
                    } catch (error) {
                        console.log('无效的JSON格式或空列表');
                    }
                    if (json && Array.isArray(json)) {
                        var numberOfLists = json.length;
                        if (numberOfLists > ListQuantity) {
                            var slicedJson = json.slice(ListQuantity);
                            slicedJson.forEach(function(group) {
                                var isAtBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 300;
                                if (group.Name === "Cookie"){
                                    UserTips(group.Msg);
                                    if (isAtBottom) scrollable.scrollTop = scrollable.scrollHeight;
                                } else if (group.Name !== nickname) {
                                    LoadUserMessages(group.Name, group.Msg, group.Time, isAtBottom);
                                }
                            });
                            ListQuantity = numberOfLists;
                            console.log("消息已刷新");
                        }
                    }
                }
            });
        });
    }
    async function asyncOperation() {
        try {
            await refreshMessage();
        } catch (error) {}
    }
    // 判断链接是不是图片
    function isImageLink(src) {
        return new Promise(function(resolve) {
            var imageExtensions = ["svg", "tiff", "tif", "ico", "webp", "heic", "heif", "raw", "jpg", "jpeg", "png", "gif", "bmp"];
            var extension = src.split('.').pop().toLowerCase();
            if (imageExtensions.includes(extension)) {
                resolve(true);
            } else {
                var img = new Image();
                img.onload = function() {
                    resolve(true);
                };
                img.onerror = function() {
                    resolve(false);
                };
                img.src = src;
            }
        });
    }
    function isLinkInTags(link, text) {
      var tagRegex = /<[^>]+>/g;
      var tags = text.match(tagRegex);
      if (tags) {
        for (var i = 0; i < tags.length; i++) {
          if (tags[i].indexOf(link) !== -1) {
            return true;
          }
        }
      }
      return false;
    }
} else if (HtmlPage.includes("ClearChatRecords.html") && getQueryVariable('isbool')){
    var JSONList;
    var bool = false;
    var bool2 = false;
    var delete_button = document.getElementById('delete-button');
    cos.getObject({
        Bucket: bucket,
        Region: region,
        Key: keys
    }, function(err, data) {
        if (err && err.statusCode === 404) {
            cos.putObject({
                Bucket: bucket,
                Region: region,
                Key: keys,
                Body: '[]'
            });
        } else if (!err) {
            var messages = data.Body.toString();
            try {
                JSONList = JSON.parse(messages);
            } catch (error) {
                console.log('无效的JSON格式或空列表');
            }
            if (JSONList && Array.isArray(JSONList)) {
                addJsonToHtml()
                bool = true;
            }
        }
        DeleteLoaders();
    });
    function addJsonToHtml() {
        var container = document.getElementById('json-container');
        container.innerHTML = '';
        JSONList.forEach(function(group, index) {
            var groupContainer = document.createElement('div');
            groupContainer.classList.add('checkbox-item');
            groupContainer.addEventListener('click', handleCheckboxClick);
            var groupCheckbox = document.createElement('input');
            groupCheckbox.style.display = 'none';
            groupCheckbox.type = 'checkbox';
            groupCheckbox.value = index;
            groupCheckbox.setAttribute('category-id', group.Name);
            groupContainer.appendChild(groupCheckbox);
            var groupLabel = document.createElement('label');
            groupLabel.classList.add('ACRONYM');
            if (group.Name === "Cookie") {
              groupLabel.setAttribute('data-symbol', '新用户');
            } else if (nickname === group.Name) {
              groupLabel.setAttribute('data-symbol', '我: ');
            } else {
              groupLabel.setAttribute('data-symbol', '@');
            }
            groupLabel.innerHTML = ((group.Name === "Cookie") ? "" : group.Name.slice(0, -11)) + '•' + group.Time;
            groupContainer.appendChild(groupLabel);
            var p = document.createElement('p');
            p.innerHTML = group.Msg.replaceAll("\n", "<br>");
            groupContainer.appendChild(p);
            container.appendChild(groupContainer);
        });
    }
    function handleCheckboxClick(event) {
        var checkbox = event.currentTarget.querySelector('input[type="checkbox"]');
        checkbox.checked = !checkbox.checked;
        if (checkbox.checked) {
            event.currentTarget.style.backgroundColor = 'green';
        } else {
            event.currentTarget.style.backgroundColor = '';
        }
        var allUnchecked = areAllCheckboxesUnchecked();
        if (allUnchecked) {
            delete_button.style.backgroundColor = '';
            delete_button.innerHTML = '刷新页面';
            delete_button.style.color = '';
        } else {
            delete_button.style.backgroundColor = 'green';
            delete_button.innerHTML = '删除选中内容';
            delete_button.style.color = 'white';
        }
        areAllUser()
    }
    function areAllCheckboxesUnchecked() {
        var checkboxes = document.querySelectorAll('input[type="checkbox"]');
        for (var i = 0; i < checkboxes.length; i++) {
            if (checkboxes[i].checked) {
                return false;
            }
        }
        return true;
    }
    function areAllUser() {
        var container = document.getElementById('delete-button2');
        var checkboxes = document.querySelectorAll('input[type="checkbox"]');
        var vida = 0;
        var vidb = 0;
        for (var i = 0; i < checkboxes.length; i++) {
            if (checkboxes[i].getAttribute('category-id') === "Cookie") {
                vida++;
                if(checkboxes[i].checked) {
                   vidb++;
                } else {
                   container.style.backgroundColor = '';
                   container.innerHTML = '全选新用户';
                   container.style.color = '';
                }
            }
        }
        if (vida === vidb && vida > 0){
           container.style.backgroundColor = 'green';
           container.innerHTML = '取消选中新用户';
           container.style.color = 'white';
           bool2 = true;
        } else {
           container.style.backgroundColor = '';
           container.innerHTML = '全选新用户';
           container.style.color = '';
           bool2 = false;
        }
        var allUnchecked = areAllCheckboxesUnchecked();
        if (allUnchecked) {
            delete_button.style.backgroundColor = '';
            delete_button.innerHTML = '刷新页面';
            delete_button.style.color = '';
        } else {
            delete_button.style.backgroundColor = 'green';
            delete_button.innerHTML = '删除选中内容';
            delete_button.style.color = 'white';
        }
    }
    function SelectNewUser() {
        var container = document.getElementById('delete-button2');
        var checkboxes = document.querySelectorAll('input[type="checkbox"]');
        if(!bool2){
        for (var i = 0; i < checkboxes.length; i++) {
            if (checkboxes[i].getAttribute('category-id') === "Cookie") {
                checkboxes[i].checked = true
                checkboxes[i].parentElement.style.backgroundColor = 'green';
                bool2 = true;
            }
        }
        }else{
        for (var i = 0; i < checkboxes.length; i++) {
            if (checkboxes[i].getAttribute('category-id') === "Cookie") {
                checkboxes[i].checked = false
                checkboxes[i].parentElement.style.backgroundColor = '';
                bool2 = false;
            }
        }
        }
        areAllUser()
    }
    function deleteSelected() {
        if (!bool) return;
        var container = document.getElementById('json-container');
        var checkboxes = container.getElementsByTagName('input');
        var selectedIndexes = [];
        for (var i = 0; i < checkboxes.length; i++) {
            if (checkboxes[i].checked) {
                selectedIndexes.push(parseInt(checkboxes[i].value));
            }
        }
        for (var j = selectedIndexes.length - 1; j >= 0; j--) {
            JSONList.splice(selectedIndexes[j], 1);
        }
        cos.putObject({
            Bucket: bucket,
            Region: region,
            Key: keys,
            Body: JSON.stringify(JSONList)
        }, function(err, data) {
            if (!err) {
                location.reload();
            }
        });
    }
} else if (HtmlPage.includes("ClearChatRecords.html")) {
   window.history.replaceState({}, null, myhtml);
   window.location = myhtml;
}
window.onunload = function() {
  sessionStorage.clear();
};
//获取页面传参
function getQueryVariable(variable) {
  var query = window.location.search.substring(1);
  var vars = query.split('&');
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=');
    if (decodeURIComponent(pair[0]) == variable) {
      return decodeURIComponent(pair[1]);
    }
  }
}
// 删除加载页面动画
function DeleteLoaders(){
  loaders.forEach(function(loader) {
    loader.remove();
  });
}
// 获取时间
function GetTime() {
    var now = new Date();
    var year = now.getFullYear();
    var month = ('0' + (now.getMonth() + 1)).slice(-2);
    var day = ('0' + now.getDate()).slice(-2);
    var hours = ('0' + now.getHours()).slice(-2);
    var minutes = ('0' + now.getMinutes()).slice(-2);
    var seconds = ('0' + now.getSeconds()).slice(-2);
    var currentTime = year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
    return currentTime;
}
// 加载系统提示
function LoadTips(tips){
    var TimeDiv = document.createElement("div");
    TimeDiv.className = "tips";
    TimeDiv.textContent = tips;
    chatContainer.appendChild(TimeDiv);
}
function UserTips(tips){
    var TimeDiv = document.createElement("div");
    TimeDiv.className = "UserTips";
    TimeDiv.textContent = tips;
    chatContainer.appendChild(TimeDiv);
}
// 设置欢迎新用户
function setNewUser(message) {
    cos.getObject({
        Bucket: bucket,
        Region: region,
        Key: keys
    }, function(err, data) {
        console.log("0");
        var json = [];
        var messages2 = data.Body.toString();
        if (err && err.statusCode === 404) {
            cos.putObject({
                Bucket: bucket,
                Region: region,
                Key: keys,
                Body: '[]'
            });
            messages2 = "[]";
        }
        try {
            json = JSON.parse(messages2);
        } catch (error) {
            json = [];
            console.log('无效的JSON格式或空列表');
        }
        var newData = {
            "Name": "Cookie",
            "Msg": message,
            "Time": GetTime()
        };
        json.push(newData);
        if (json && Array.isArray(json)) {
            cos.putObject({
                Bucket: bucket,
                Region: region,
                Key: keys,
                Body: JSON.stringify(json)
            }, function(err, data) {
                if (!err) {
                    ListQuantity++;
                    UserTips(message);
                    scrollable.scrollTop = scrollable.scrollHeight;
                    location.reload();
                }
            });
        }
    });
}
// 设置Cookie
function setCookie(Name) {
    var nick = (Name + getRandomCode(11)).slice(1, -1);
    document.cookie = "nickname" + '=' + nick;
    localStorage.setItem("nickname", nick);
    setNewUser("欢迎 " + nick.slice(0, -11) + " 来到聊天室");
}
// 获取cookie里的内容
function getOrCreateCookie(Name, defaultValue) {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith(Name + '=')) {
            return cookie.substring(Name.length + 1);
        }
    }
    const cachedValue = localStorage.getItem(Name);
    if (cachedValue) {
        return cachedValue;
    }
    setNewUser("欢迎 " + defaultValue.slice(0, -11) + " 来到聊天室");
    document.cookie = Name + '=' + defaultValue;
    localStorage.setItem(Name, defaultValue);
    return defaultValue;
}
// 生成随机昵称
function rand_nick() {
    var name_tou = ["快乐的", "冷静的", "醉熏的", "潇洒的", "糊涂的", "积极的", "冷酷的", "深情的", "粗暴的", "温柔的", "可爱的", "愉快的", "义气的", "认真的", "威武的", "帅气的", "传统的", "潇洒的", "漂亮的", "自然的", "专一的", "听话的", "昏睡的", "狂野的", "等待的", "搞怪的", "幽默的", "魁梧的", "活泼的", "开心的", "高兴的", "超帅的", "坦率的", "直率的", "轻松的", "痴情的", "完美的", "精明的", "无聊的", "丰富的", "繁荣的", "饱满的", "炙热的", "暴躁的", "碧蓝的", "俊逸的", "英勇的", "健忘的", "故意的", "无心的", "土豪的", "朴实的", "兴奋的", "幸福的", "淡定的", "不安的", "阔达的", "孤独的", "独特的", "疯狂的", "时尚的", "落后的", "风趣的", "忧伤的", "大胆的", "爱笑的", "矮小的", "健康的", "合适的", "玩命的", "沉默的", "斯文的", "任性的", "细心的", "粗心的", "大意的", "甜甜的", "酷酷的", "健壮的", "英俊的", "霸气的", "阳光的", "默默的", "大力的", "孝顺的", "忧虑的", "着急的", "紧张的", "善良的", "凶狠的", "害怕的", "重要的", "危机的", "欢喜的", "欣慰的", "满意的", "跳跃的", "诚心的", "称心的", "如意的", "怡然的", "娇气的", "无奈的", "无语的", "激动的", "愤怒的", "美好的", "感动的", "激情的", "激昂的", "震动的", "虚拟的", "超级的", "寒冷的", "精明的", "明理的", "犹豫的", "忧郁的", "寂寞的", "奋斗的", "勤奋的", "现代的", "过时的", "稳重的", "热情的", "含蓄的", "开放的", "无辜的", "多情的", "纯真的", "拉长的", "热心的", "从容的", "体贴的", "风中的", "曾经的", "追寻的", "儒雅的", "优雅的", "开朗的", "外向的", "内向的", "清爽的", "文艺的", "长情的", "平常的", "单身的", "伶俐的", "高大的", "懦弱的", "柔弱的", "爱笑的", "乐观的", "耍酷的", "酷炫的", "神勇的", "年轻的", "唠叨的", "瘦瘦的", "无情的", "包容的", "顺心的", "畅快的", "舒适的", "靓丽的", "负责的", "背后的", "简单的", "谦让的", "彩色的", "缥缈的", "欢呼的", "生动的", "复杂的", "慈祥的", "仁爱的", "魔幻的", "虚幻的", "淡然的", "受伤的", "雪白的", "高高的", "糟糕的", "顺利的", "闪闪的", "羞涩的", "缓慢的", "迅速的", "优秀的", "聪明的", "含糊的", "俏皮的", "淡淡的", "坚强的", "平淡的", "欣喜的", "能干的", "灵巧的", "友好的", "机智的"];
    var name_wei = ["嚓茶", "凉面", "便当", "毛豆", "花生", "可乐", "灯泡", "野狼", "背包", "眼神", "缘分", "雪碧", "人生", "牛排", "蚂蚁", "飞鸟", "灰狼", "斑马", "汉堡", "悟空", "巨人", "绿茶", "大碗", "墨镜", "魔镜", "煎饼", "月饼", "月亮", "星星", "芝麻", "啤酒", "玫瑰", "大叔", "小伙", "太阳", "树叶", "芹菜", "黄蜂", "蜜粉", "蜜蜂", "信封", "西装", "外套", "裙子", "大象", "猫咪", "母鸡", "路灯", "蓝天", "白云", "星月", "彩虹", "微笑", "摩托", "板栗", "高山", "大地", "大树", "砖头", "楼房", "水池", "鸡翅", "蜻蜓", "红牛", "咖啡", "枕头", "大船", "诺言", "钢笔", "刺猬", "天空", "飞机", "大炮", "冬天", "洋葱", "春天", "夏天", "秋天", "冬日", "航空", "毛衣", "豌豆", "黑米", "玉米", "眼睛", "老鼠", "白羊", "帅哥", "美女", "季节", "鲜花", "服饰", "裙子", "秀发", "大山", "火车", "汽车", "歌曲", "舞蹈", "老师", "导师", "方盒", "大米", "麦片", "水杯", "水壶", "手套", "鞋子", "鼠标", "手机", "电脑", "书本", "奇迹", "身影", "香烟", "夕阳", "台灯", "宝贝", "未来", "皮带", "钥匙", "心锁", "故事", "花瓣", "滑板", "画笔", "画板", "学姐", "店员", "电源", "饼干", "宝马", "过客", "大白", "时光", "石头", "钻石", "河马", "犀牛", "西牛", "绿草", "抽屉", "柜子", "往事", "寒风", "路人", "橘子", "耳机", "鸵鸟", "朋友", "苗条", "铅笔", "钢笔", "硬币", "热狗", "大侠", "御姐", "萝莉", "毛巾", "期待", "盼望", "白昼", "黑夜", "大门", "黑裤", "哑铃", "板凳", "枫叶", "荷花", "乌龟", "衬衫", "大神", "草丛", "早晨", "心情", "茉莉", "流沙", "蜗牛", "猎豹", "棒球", "篮球", "乐曲", "电话", "网络", "世界", "中心", "老虎", "鸭子", "羽毛", "翅膀", "外套", "书包", "钢笔", "冷风", "烤鸡", "大雁", "音响", "招牌", "冰棍", "帽子"];
    var adjective = name_tou[Math.floor(Math.random() * name_tou.length)];
    var noun = name_wei[Math.floor(Math.random() * name_wei.length)];
    return adjective + noun + "·" + getRandomCode(10);
}
// 生成随机数
function getRandomCode(mo) {
    var letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var randomCode = '';
    for (var i = 0; i < mo; i++) {
        var randomIndex = Math.floor(Math.random() * letters.length);
        randomCode += letters[randomIndex];
    }
    return randomCode;
}
// 文字转图片
function LetterAvatar(letter, size) {
    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d");
    var fontSize = size * 0.5;
    var width = size;
    var height = size;
    canvas.width = width;
    canvas.height = height;
    var color = stringToColor(letter);
    context.fillStyle = color;
    context.fillRect(0, 0, width, height);
    context.font = fontSize + "px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    context.fillText(letter.charAt(0), width / 2, height / 2);
    return canvas.toDataURL();
}
// 将字符串转换为颜色十六进制编码
function stringToColor(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    var color = "#";
    for (var j = 0; j < 3; j++) {
        var value = (hash >> (j * 8)) & 0xff;
        color += ("00" + value.toString(16)).substr(-2);
    }
    return color;
}
// toast提示
function toast(mag) {
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = mag;
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.classList.add('show');
        setTimeout(function() {
            toast.classList.remove('show');
            setTimeout(function() {
                toast.remove();
            }, 300);
        }, 500);
    }, 100);
}
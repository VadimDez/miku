// HANDLE ALL BOT COMMANDS 
const _ = require('./globals');
const waifu = require('./waifu/waifu');
const { 
  filterGroups, 
  prettyPrint, 
  sendAndDeleteAfter, 
} = require('./helper');

const db = require('./database/dbfunctions');
const deleted = require('./database/models/deleted')
const emojiStrip = require('emoji-strip');
const axios = require('axios');
const cheerio = require('cheerio')

module.exports.parseMsg = async function(msg, client){
  let body = msg.body.split('-')[0].trim();

  if(body.startsWith(_.BOT_COMMAND) || body.startsWith(_.EVERYONE)){
      let chat = await msg.getChat();
      let sender = parseInt(msg.author ?? msg.from);

      let list = _.BLACKLIST[emojiStrip(chat.name)];
      //console.log(list, Object.keys(list).length)

      if(list && Object.keys(list).length && list[sender]){
        sendAndDeleteAfter(msg, prettyPrint(_.REPLIES.NOPOWER));
        return;
      }
  }

  let options = msg.body.split('-')[1];
  if(options)
    options = options.trim();
  switch(body){
    case _.EVERYONE: {
      tagEveryone(msg, client);
      break;
    }
    case _.BOT_COMMAND: {
      printCommands(msg);
      break;
    }
    case _.REVEAL_COMMAND: {
      let params = [];
      if(options)
        params = options.split(" ");
      revealMessage(msg, params);
      break;
    }
    case _.BLOCK_GROUP: {
      blockGroup(msg);
      break;
    }
    case _.UNBLOCK_GROUP: {
      unblockGroup(msg);
      break;
    }
    case _.POLL_START : {
      startpoll(msg)
      break;
    }
    case _.POLL_YES : {
      markYes(msg)
      break;
    }
    case _.POLL_NO : {
      markNo(msg)
      break;
    }
    case _.POLL_STATUS : {
      pollstatus(msg);
      break;
    }
    case _.POLL_STOP : {
      stoppoll(msg);
      break;
    }
    case _.ANNOUNCEMENTS : {
      announcements(msg);
      break;
    }
    default: {
      if(body.startsWith(_.SFW_WAIFU_COMMAND) || body.startsWith(_.NSFW_WAIFU_COMMMAND)){
        waifu(msg);
      }
      if(body.startsWith(_.BLACKLIST_COMMAND)){
        blacklist(msg);
      }
      if(body.startsWith(_.WHITELIST_COMMAND)){
        whitelist(msg);
      }
    }
    
  }
}

async function fetchannouncements(msg){
  let message = 'Please wait while we fetch the details';
  sendAndDeleteAfter(msg, prettyPrint(message));
  await axios.get('https://nith.ac.in/all-announcements').then(response => {
    const html = response.data;
    const $ = cheerio.load(html);
    const data = $('tbody:first-of-type a')

    let data_array = Array.from(data);
    let raw_data = data_array.slice(0,5);

    let replyMessage = `[ Latest 5 announcements from nith.ac.in]\n\n`;
    let links = [];

    for(item of raw_data){

      let link = {
        text : item.children['0'].data,
        href : item.attribs.href
      }
      
      links.push(link);
    }
    _.ANNOUNCEMENTS_DATA.last_fetched = new Date();
    _.ANNOUNCEMENTS_DATA.data = links;

});
}

async function announcements(msg){
  let chat = await msg.getChat();
  let last_fetched = _.ANNOUNCEMENTS_DATA.last_fetched;
  if(last_fetched){
    let now = new Date();
    let time_diff = now.getTime() - last_fetched.getTime();

    if(time_diff/(1000 * 60) > 10){
      await fetchannouncements(msg);
    }
  } else {
    await fetchannouncements(msg);
  }

  let data = _.ANNOUNCEMENTS_DATA.data;

  let replyMessage = `[ Latest 5 announcements from nith.ac.in]\n\n`;

  for(item of data){
    replyMessage += `*Title* : ${item.text}\n`
    replyMessage += `*Link* : ` + item.href;
    replyMessage += '\n\n\n'
  }

  replyMessage += `\n\n *Last Fetched* : around ${Math.floor((new Date().getTime() - _.ANNOUNCEMENTS_DATA.last_fetched.getTime())/(1000 * 60))} min. ago\n\n`

  sendAndDeleteAfter(msg, replyMessage);
}

async function blacklist(msg){
  if(!msg.fromMe){
    let replyMessage = 'You cannot use this command';
    sendAndDeleteAfter(msg, prettyPrint(replyMessage));
    return;
  }
  let chat = await msg.getChat();
  let ids = msg.mentionedIds;
  if(!_.BLACKLIST[emojiStrip(chat.name)])
    _.BLACKLIST[emojiStrip(chat.name)] = {}
  
  for(id of ids){
    _.BLACKLIST[emojiStrip(chat.name)][parseInt(id)] = 1;
  } 
  console.log(_.BLACKLIST)
  deleted.findOneAndUpdate({}, {$set:{blacklist:_.BLACKLIST}}, {useFindAndModify: false}).catch(err => {
    console.log(err);
  })
}

async function whitelist(msg){
  if(!msg.fromMe){
    let replyMessage = 'You cannot use this command';
    sendAndDeleteAfter(msg, prettyPrint(replyMessage));
    return;
  }
  let chat = await msg.getChat();
  let ids = msg.mentionedIds;

  if(!_.BLACKLIST[emojiStrip(chat.name)])
    return;

  for(id of ids){
    delete _.BLACKLIST[emojiStrip(chat.name)][parseInt(id)];
  }

  if(!Object.keys(_.BLACKLIST[emojiStrip(chat.name)]).length)
    delete _.BLACKLIST[emojiStrip(chat.name)];

  deleted.findOneAndUpdate({}, {$set:{blacklist:_.BLACKLIST}}, {useFindAndModify: false}).catch(err => {
      console.log(err);
  })
}

async function tagEveryone(msg, client){
  console.log(msg);

  let chat = await msg.getChat();
  console.log('chat object', chat);
  // RETURN IF NOT IN A GROUP
  if(!chat.isGroup){
    sendAndDeleteAfter(msg, prettyPrint(_.REPLIES.NOTGROUP));
    return;
  }

  if(filterGroups(chat)){
    sendAndDeleteAfter(msg, prettyPrint(_.REPLIES.UNAVAIL));
    return;
  }

  let text = "";
  let mentions = [];

  for(let participant of chat.participants) {
    const contact = await client.getContactById(participant.id._serialized);

    mentions.push(contact);
    text += `@${participant.id.user} `;
  }

  // THIS MESSAGE SHOULD NOT BE AUTODELETED
  chat.sendMessage(text, { mentions });
}

function printCommands(msg){
  let commands = `
[!miku]  - show all commands.

[!minna] - tag everyone.

[!miku sfw] - print categories.
  ---> [!miku sfw <category>]

[!miku reveal] - reveal last 
                 deleted chat.

[!miku block] - restrict access.

[!miku unblock] - allow access.

Source Code: https://github.com/harsh-sheth/miku
Submit Ideas: https://github.com/HARSH-SHETH/miku/discussions/2
Wiki: https://github.com/HARSH-SHETH/miku/wiki/Bot-Commands
`
  sendAndDeleteAfter(msg, prettyPrint(commands), { sendSeen: false }, _.MSG_DEL_TIMEOUT);
}


// BLOCK GROUPS TO USE CERTAIN COMMANDS
async function blockGroup(msg){
  if(!msg.fromMe){
    sendAndDeleteAfter(msg, prettyPrint(_.REPLIES.PRIVILEGE));
    return;
  }
  let chat = await msg.getChat(); 
  if(!chat.isGroup){
    sendAndDeleteAfter(msg, prettyPrint(_.REPLIES.NOTGROUP));
    return;
  }
  let groupName = emojiStrip(chat.name);
  _.FILTER_GROUPS.forEach((group) => {
    if(group == groupName){
      return;
    }
  });
  db.addGroup(groupName, function(){
    _.FILTER_GROUPS.push(groupName);
    sendAndDeleteAfter(msg, prettyPrint(_.REPLIES.BLOCKED))
    console.log(_.FILTER_GROUPS);
  });
}

// UNBLOCK GROUP
async function unblockGroup(msg){
  if(!msg.fromMe){
    sendAndDeleteAfter(msg, prettyPrint(_.REPLIES.PRIVILEGE))
    return;
  }
  let chat = await msg.getChat(); 
  if(!chat.isGroup){
    sendAndDeleteAfter(msg, prettyPrint(_.REPLIES.NOTGROUP));
    return;
  }
  let groupName = emojiStrip(chat.name);
  db.removeGroup(groupName, () => {
    _.FILTER_GROUPS.forEach(function(group, i){
      if(group == groupName){
        // REMOVE GROUP FROM FILTER_GROUPS ARRAY
        this.splice(i, 1)
        console.log(_.FILTER_GROUPS);
        sendAndDeleteAfter(msg, prettyPrint(_.REPLIES.UNBLOCKED));
        return;
      }
    }, _.FILTER_GROUPS);
  });
}

async function revealMessage(msg, params) {
  // _.DELETEDMESSAGE[msg.]
  let chat = await msg.getChat();
  let deletedMessage = _.DELETEDMESSAGE[emojiStrip(chat.name)];
  if(deletedMessage === undefined){
    sendAndDeleteAfter(msg, prettyPrint(_.REPLIES.NO_DEL_MSG));
    return;
  }else{
    // GROUPNAME IMPLIES TO TITLE CHAT NAME
    let groupName = emojiStrip(chat.name);
    let elements = _.DELETEDMESSAGE[groupName];
    if(!params[0])
      params[0] = 1;
    
    if(!parseInt(params[0])){
      sendAndDeleteAfter(msg, prettyPrint('Please send a valid count'));
      return;
    }
    let total = elements.length;
    let count = Math.min(elements.length, parseInt(params[0]));

    let replyMessage = `[Showing ${count}/${total} deleted messages]\n\n`;

    for(let i=0;i<count;i++){
      replyMessage += `Message:${elements[i].message}\nFrom:${elements[i].from}\n\n`;
    }

    sendAndDeleteAfter(msg, prettyPrint(replyMessage));
  }
}

async function startpoll(msg){
    let chat = await msg.getChat();
    if(!chat.isGroup){
      sendAndDeleteAfter(msg, prettyPrint(_.REPLIES.NOTGROUP));
      return;
    }
    if(_.POLL_DATA[chat.name]){
      sendAndDeleteAfter(msg, prettyPrint(_.REPLIES.POLLRUNNING));
      return; 
    }
    msg.reply(prettyPrint(_.REPLIES.POLLACTIVE));

    let sender = parseInt(msg.author ?? msg.from)
    _.POLL_DATA[chat.name] = {
      active:true, 
      data:new Map(),
      host:sender
    }
}

async function pollstatus(msg){
  let chat = await msg.getChat();
  if(!_.POLL_DATA[chat.name]){
    sendAndDeleteAfter(msg, prettyPrint(_.REPLIES.NOPOLL));
    return;
  }
  const itr =  _.POLL_DATA[chat.name].data[Symbol.iterator]();
      let yes = 0, count = 0;
      let host = _.POLL_DATA[chat.name].host;
      for(const item of itr){
        count++;
        if(item[1])
          yes++;
      }
      let replyMessage = 'Poll Status\nYes:' + `${count ? (yes/count) * 100 : 0} %\nNo:` + `${count ? ((count - yes)/count) * 100 : 0} %\n\nParticipants:` + `${count}\nPoll Host:` + `${host}`;
      chat.sendMessage(prettyPrint(replyMessage));

}

async function stoppoll(msg){
  let chat = await msg.getChat();
  let sender = parseInt(msg.author ?? msg.from)
  if(!_.POLL_DATA[chat.name]){
    sendAndDeleteAfter(msg, prettyPrint(_.REPLIES.NOPOLL));
    return;
  }

  if(sender === _.POLL_DATA[chat.name].host || msg.fromMe){
    const itr =  _.POLL_DATA[chat.name].data[Symbol.iterator]();
      let yes = 0, count = 0;
      let host = _.POLL_DATA[chat.name].host;
      for(const item of itr){
        count++;
        if(item[1])
          yes++;
      }
      delete _.POLL_DATA[chat.name];
      let replyMessage = 'Poll Results\nYes:' + `${count ? (yes/count) * 100 : 0} %\nNo:` + `${count ? ((count - yes)/count) * 100 : 0} %\n\nParticipants:` + `${count}\nPoll Host:` + `${host}`;
      chat.sendMessage(prettyPrint(replyMessage));
  } else {
    sendAndDeleteAfter(msg, prettyPrint(_.REPLIES.HOSTONLY));
  }
}

async function markYes(msg){
    let chat = await msg.getChat();
    if(_.POLL_DATA[chat.name]){
      let sender = parseInt(msg.author ?? msg.from)
      _.POLL_DATA[chat.name].data.set(sender, 1);
    } else {
      sendAndDeleteAfter(msg, prettyPrint(_.REPLIES.NOPOLL));
    }
}

async function markNo(msg){
  let chat = await msg.getChat();
  if(_.POLL_DATA[chat.name]){
    let sender = parseInt(msg.author ?? msg.from)
    _.POLL_DATA[chat.name].data.set(sender, 0);
  } else {
    sendAndDeleteAfter(msg, prettyPrint(_.REPLIES.NOPOLL));
  }
}

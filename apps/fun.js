import _ from 'lodash'
import fetch from 'node-fetch'
import plugin from '../../../lib/plugins/plugin.js'
import { Config } from '../components/index.js'
import { faildsImgs, heisiType, pandadiuType, successImgs } from '../constants/fun.js'
import { QQApi, common, funApi, memes, uploadRecord } from '../model/index.js'

/** API请求错误文案 */
const API_ERROR = '❎ 出错辣，请稍后重试'

/** 开始执行文案 */
const START_EXECUTION = '椰奶产出中......'

const picApis = Config.getConfig('picApi')
/** 解析匹配模式 */
const picApiKeys = []

_.forIn(picApis, (values, key) => {
  let mode = values.mode !== undefined ? values.mode : picApis.mode
  key = key.split('|').map(item => mode ? '^' + item + '$' : item).join('|')
  picApiKeys.push(key)
})

const apiReg = new RegExp(`(${picApiKeys.join('|')}|^jktj$|^接口统计$)`)

export class Fun extends plugin {
  constructor () {
    super({
      name: '椰奶娱乐',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: '^#唱歌$',
          fnc: 'Sing'
        },
        {
          reg: '^#支付宝到账',
          fnc: 'ZFB'
        },
        {
          reg: '^#(([\u4e00-\u9fa5]{2,6})-)?([\u4e00-\u9fa5]{2,6})?翻译(.*)$',
          fnc: 'youdao'
        },
        {
          reg: 'github.com/[a-zA-Z0-9-]{1,39}/[a-zA-Z0-9_-]{1,100}',
          fnc: 'GH'
        }

      ]
    })
  }

  /** 随机唱鸭 */
  async Sing (e) {
    let data = await funApi.randomSinging()
    if (data.error) return e.reply(data.error)
    await e.reply(await uploadRecord(data.audioUrl, 0, false))
    await e.reply(data.lyrics)
  }

  /** 支付宝语音 */
  async ZFB (e) {
    let amount = parseFloat(e.msg.replace(/#|支付宝到账|元|圆/g, '').trim())

    if (!/^\d+(\.\d{1,2})?$/.test(amount)) return e.reply('你觉得这河里吗！！', true)

    if (!(amount >= 0.01 && amount <= 999999999999.99)) {
      return e.reply('数字大小超出限制，支持范围为0.01~999999999999.99')
    }
    e.reply([segment.record(`https://mm.cqu.cc/share/zhifubaodaozhang/mp3/${amount}.mp3`)])
  }

  /** 有道翻译 */
  async youdao (e) {
    const msg = e.msg.match(/#(([\u4e00-\u9fa5]{2,6})-)?([\u4e00-\u9fa5]{2,6})?翻译(.*)/)
    // 如果是在群聊中回复，则获取上一条消息作为翻译内容
    if (e.source) {
      const source = e.isGroup
        ? (await e.group.getChatHistory(e.source.seq, 1)).pop()
        : (await e.friend.getChatHistory(e.source.time, 1)).pop()

      msg[4] = source.message
        .filter(item => item.type === 'text')
        .map(item => item.text).join('')
    }
    const results = await funApi.youdao(msg[4], msg[3], msg[2])
    e.reply(results, true)
  }

  // github
  async GH (e) {
    const api = 'https://opengraph.githubassets.com'

    let reg = /github.com\/[a-zA-Z0-9-]{1,39}\/[a-zA-Z0-9_-]{1,100}(?:\/(?:pull|issues)\/\d+)?/
    const isMatched = e.msg.match(reg)

    const id = 'Yenai'
    if (isMatched) {
      // const res = isMatched[0].split('/')
      let path = isMatched[0].replace('github.com/', '')
      e.reply(segment.image(`${api}/${id}/${path}`))
      // const [user, repo] = [res[1], res[2].split('#')[0]]
      // e.reply(segment.image(`${api}/${id}/${user}/${repo}`))
    }
  }

  // api大集合
  async picture (e) {
    let { sese, sesepro } = Config.getGroup(e.group_id)
    if (!sese && !sesepro && !e.isMaster) return false
    let key = 'yenai:apiAggregate:CD'
    if (await redis.get(key)) return false

    if (/jktj|接口统计/.test(e.msg)) {
      let msg = ['现接口数量如下']
      for (let i in picApis) {
        if (i == 'mode') continue
        let urls = picApis[i].url || picApis[i]
        msg.push(`\n♡ ${i} => ${Array.isArray(urls) ? urls.length : 1}`)
      }
      return e.reply(msg)
    }
    // 解析消息中的类型
    let regRet = apiReg.exec(e.msg)
    if (regRet[1] == 'mode') return false
    let picObj = picApis[_.sample(Object.keys(picApis).filter(item => new RegExp(item).test(regRet[1])))]
    if (Array.isArray(picObj)) picObj = _.sample(picObj)
    let urlReg = /^https?:\/\/(([a-zA-Z0-9_-])+(\.)?)*(:\d+)?(\/((\.)?(\?)?=?&?[a-zA-Z0-9_-](\?)?)*)*$/i
    if (!picObj.url && !urlReg.test(encodeURI(picObj)) && !Array.isArray(picObj)) {
      return logger.error(`${e.logFnc}未找到url`)
    }

    if (picObj.type !== 'image' && picObj.type !== 'text' && picObj.type !== 'json' && picObj.type) {
      return logger.error(`${e.logFnc}类型不正确`)
    }

    let url = picObj.url || picObj
    // 数组随机取或指定
    if (Array.isArray(url)) url = _.sample(url)

    url = encodeURI(url)

    if (picObj.type == 'text') {
      url = await fetch(url).then(res => res.text()).catch(err => logger.error(err))
    } else if (picObj.type == 'json') {
      if (!picObj.path) return logger.error(`${e.logFnc}json未指定路径`)
      let res = await fetch(url).then(res => res.json()).catch(err => logger.error(err))
      url = _.get(res, picObj.path)
    }
    if (!url) return logger.error(`${e.logFnc}未获取到图片链接`)

    logger.debug(`${e.logFnc}使用接口:${url}`)
    common.recallsendMsg(e, segment.image(url))
    redis.set(key, 'cd', { EX: 2 })
  }
}

import plugin from '../../../lib/plugins/plugin.js'
import os from 'os';
import { render, Config } from '../components/index.js'
import { CPU, common } from '../model/index.js'
import moment from 'moment';
// import si from 'systeminformation'
let si = await redis.get('yenai:node_modules') ? await import("systeminformation") : false
import lodash from 'lodash'
let interval = false;
export class example extends plugin {
  constructor() {
    super({
      name: '椰奶状态',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: '^#?(椰奶)?状态(pro)?$',
          fnc: 'state'
        }
      ]

    })
  }

  async state(e) {
    if (!/椰奶/.test(e.msg) && !Config.Notice.state) {
      return false;
    }
    if (!si) return e.reply("❎ 没有检测到systeminformation依赖，请运行：'pnpm add systeminformation -w'进行安装")
    //防止多次触发
    if (interval) { return } else interval = true;
    //系统
    let osinfo = await si.osInfo();
    //可视化数据
    let visualData = lodash.compact([
      //CPU板块
      await CPU.getCpuInfo(osinfo.arch),
      //内存板块
      await CPU.getMemUsage(),
      //GPU板块
      await CPU.getGPU(),
      //Node板块
      await CPU.getNodeInfo()
    ])
    //渲染数据
    let data = {
      //头像
      portrait: `https://q1.qlogo.cn/g?b=qq&s=0&nk=${Bot.uin}`,
      //运行时间
      runTime: Formatting(Date.now() / 1000 - Bot.stat.start_time, true),
      //日历
      calendar: moment().format("YYYY-MM-DD HH:mm:ss"),
      //昵称
      nickname: Bot.nickname,
      //系统运行时间
      systime: Formatting(os.uptime(), true),
      //收
      recv: Bot.statistics.recv_msg_cnt,
      //发
      sent: await redis.get(`Yz:count:sendMsg:total`) || 0,
      //图片
      screenshot: await redis.get(`Yz:count:screenshot:total`) || 0,
      //nodejs版本
      nodeversion: process.version,
      //群数
      group_quantity: Array.from(Bot.gl.values()).length,
      //好友数
      friend_quantity: Array.from(Bot.fl.values()).length,
      //登陆设备
      platform: common.platform[Bot.config.platform],
      //在线状态
      status: common.status[Bot.status],
      //硬盘内存
      HardDisk: await CPU.getfsSize(),
      //FastFetch
      FastFetch: await CPU.getFastFetch(e),
      // 取插件
      plugin: CPU.numberOfPlugIns,
      //硬盘速率
      fsStats: CPU.DiskSpeed,
      //网络
      network: CPU.getnetwork,
      //可视化数据
      visualData,
      //系统信息
      osinfo,
    }
    //渲染图片
    await render('state/state', {
      ...data,
    }, {
      e,
      scale: 2.0
    })
    interval = false;
  }


}

/**
 * @description: 格式化时间
 * @param {Number} time 秒数
 * @param {boolean} yes  是否补零
 * @return {String} 天:?时:分:秒
 */
function Formatting(time, repair) {
  let times = common.getsecond(time, repair)

  let { second, minute, hour, day } = times

  if (day > 0) {
    return day + "天 " + hour + ":" + minute + ":" + second
  } else {
    return hour + ":" + minute + ":" + second
  }

}

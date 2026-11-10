/**
 * 首页上站长自己写的东西：自我介绍和头像史。改这里就行。
 * 现在都是占位：自我介绍是按站长气质写的草稿，头像还没有图（AvatarPlaceholder 画一块印着名字头一个字的方块）。
 */
import type { CategoryKey } from './home-data';

/** 自我介绍，一项一段；第一段大一号 */
export const INTRO = [
  '我是 cirnonine。',
  '这里记下的，是我从头走到尾的那些游戏、视觉小说、动画，和听完没舍得删的歌。很多已经想不起是哪一年，只记得那时候的房间，和窗外的天色。',
  '这里没有分数，也不推荐什么。它们在我身上留下了什么，我就写什么；写不出来的，就先空着。',
];

/**
 * 头像史：第一个是现在的头像，往后是更早的。头像只安静地放着，不用文字介绍。
 * 角色出自已有的记录时写 record（类别和 slug），头像就链到那条记录。顺序待站长确认。
 */
export const AVATARS: { name: string; from: string; record?: [CategoryKey, string] }[] = [
  { name: '小早川凛子', from: 'ラブプラス' },
  { name: '久我山栞', from: '久我山栞の死様手帖', record: ['visual-novels', 'kugayama-shiori-no-shinizama-techou'] },
  { name: '初华', from: 'BanG Dream! Ave Mujica', record: ['anime', 'bang-dream-ave-mujica'] },
  { name: '02', from: 'ダーリン・イン・ザ・フランキス' },
  { name: '大阪', from: 'あずまんが大王' },
  { name: '琪露诺', from: '東方Project' },
];

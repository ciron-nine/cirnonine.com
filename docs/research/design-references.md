# 设计参考调研

> 调研日期：2026-11-07。用于 cirnonine.com（Astro + Cloudflare Pages）的原型阶段。
> 术语沿用 `GLOSSARY.md`：外壳、类别、专属页、我的声音、原名、心头好、很久以前、进入页、背景音乐、语录、短评、长评。

**核实方式。** 文中每个 URL 都在调研当天打开过：用 curl 检查返回 200，对屏蔽机器人的站点（Codrops、Devolver 等返回 403/429）则在浏览器里实际打开。凡是写了“首页是……”“页面上有……”的描述，都是亲眼看过页面后写的；关于唱片封面历史的事实来自所引页面原文。调研时网页搜索工具不可用，所以候选站点来自已知的一手来源，再加上抓取 Hoverstates、Awwwards 列表页的结果，可能漏掉一些近期好站。

---

## 1. 个人站 / 作品集参考

### 1.1 精选站点

每条格式：**站点**：值得借鉴的地方 → 对应本站哪一页。

- **Feltron（Nicholas Felton）** <https://feltron.com/>：首页是一整段超大字号、逗号分隔的项目名和年份，每个词都是一个 `index-link`，页面上没有一张图片；年份链接到他每年的个人数据年报（Feltron Annual Report）。这几乎就是候选首页 A（排版自画像段落）的现成样本：作品名本身就是链接，靠颜色深浅区分类型。→ **首页 A**；年报的思路也适用于 **首页 C/D**。
- **Experimental Jetset 在线档案** <https://www.jetset.nl/>：荷兰工作室的档案页是一张极小字号的纯文字表格，按字母序、目录和年代序三栏排列，有很强的 Swiss / post-punk 冷感。→ **类别页**的索引形态；按年代分组时，“很久以前”排在最后一组。
- **Elisa Breyer Archive** <https://www.elisabreyerarchive.com/>：同一批作品可以在 `chronological / list / random` 三种视图之间切换，切换控件是页面顶部一个小胶囊。→ **类别页**的“同一份数据、多种视图”，也可以作为“由数据自动选版式”的退路。
- **Laurel Schwulst** <https://laurelschwulst.com/>：左上是一列大字号单词导航（writing / websites / worlds / teaching / talks / everything / today），右侧是带日期的小字条目和图片，像一本翻开的笔记。她的文章 *My website is a shifting house next to a river of knowledge* <https://thecreativeindependent.com/essays/laurel-schwulst-my-website-is-a-shifting-house-next-to-a-river-of-knowledge-what-could-yours-be/> 把个人网站看作“住所”和自我表达，可以给“网站是自画像”（ADR 0005）当论据。→ **首页 A** 与 **外壳导航**。
- **Frank Chimero** <https://frankchimero.com/>：深灰绿底，极小的等宽字两栏列表，每项是一个标题加一行灰色小注。安静、私密，信息密度却不低。→ **外壳**的字号与留白尺度；**我的声音**的小字注释样式。
- **Ryoji Ikeda** <https://www.ryojiikeda.com/>：纯黑白。顶部是极小字号的分类导航，铺成两行表格；下面是大图配一两行小字说明。气质最接近 post-punk 的冷峻。→ **外壳**导航；**类别页**的“大图 + 极小说明”节奏。
- **Everest Pipkin** <https://everest-pipkin.com/>：手写 HTML 的质感：侧栏是长长的作品列表，中间一幅黑白线描插图，下面用第一人称写一段自我介绍。粗糙、真诚，没有模板味。→ **首页 A/C** 的第一人称语气；“有点粗糙”的外壳气质。
- **Soft Labor** <https://www.softlabor.biz/>：奶油色底上一个巨大的颗粒点刻（stippled）衬线字标，其余全是小号大写衬线字。→ 颗粒、做旧的标题处理（对应 midwest emo 的照片颗粒感），可以用 SVG `feTurbulence` 实现，见第 3.2 节。
- **Rauno Freiberg** <https://rauno.me/>：首屏只有浅灰底上一个白色画框、一个十字准星，顶部一行细刻度，用极少的元素承载交互。→ **进入页**：一个安静的“点这里开始”，不必做成启动动画。
- **Craig Mod** <https://craigmod.com/>：作家兼摄影师的个人站，深色底、小字导航散在四角，长期以文字和照片为核心。→ **长评**详情页的阅读氛围，以及“照片 + 文字”的私人记录感。
- **ヨルシカ（Yorushika）官网** <https://yorushika.com/>：首页主视觉是一只牛皮纸信封的实物照片，左侧窄栏放竖排小字导航，把专辑当作一件实物来呈现。→ **首页 D**（唱片内页式）的实物感；日文竖排导航。
- **ガールズバンドクライ（Girls Band Cry）剧场版官网** <https://girls-band-cry.com/>：粗黑体日文片名，加上一句灰色手写体短句叠在插画上。作品的声音（插画、片名）和一层“手写的人声”同处一屏。→ **我的声音**叠加在作品封面上的方式；**专属页**的日文标题排版。
- **ずっと真夜中でいいのに。（ZUTOMAYO）官网** <https://zutomayo.net/>：整页铺满浅灰色铅笔线稿，图标和导航很小，手绘、杂乱又克制。→ **音乐类别页**的背景肌理；线稿感的颗粒层。

### 1.2 策展站点（继续找灵感用）

- Hoverstates <https://hoverstat.es/>：偏实验、偏文化机构的站点，比 Awwwards 更接近本站气质。本次从这里抓到 typohypergraphicobject、Elisa Breyer Archive、Soft Labor 等。
- Minimal Gallery <https://minimal.gallery/>：极简、留白多的站点。
- httpster <https://httpster.net/>
- siteInspire <https://www.siteinspire.com/>：对脚本访问返回 429，浏览器里正常。
- Godly <https://godly.website/>：注意，调研当天这个域名已经跳转到 <https://recent.design/?ref=godly>。
- Awwwards 作品集分类 <https://www.awwwards.com/websites/portfolio/>、排版分类 <https://www.awwwards.com/websites/typography/>：当前入选作品多是 3D、WebGPU、游戏化交互（例如“可以开车的 3D 车库”），和本站“安静、克制”的方向相反，只适合给专属页找技术点子。
- Typewolf Site of the Day <https://www.typewolf.com/site-of-the-day>：按字体组合策展，适合找字体搭配。
- Brutalist Websites <https://brutalistwebsites.com/>：raw、post-punk 方向。
- One Page Love <https://onepagelove.com/>、CSS Design Awards <https://www.cssdesignawards.com/>

---

## 2. 非网格版式：实例与手机端处理

> 通用提醒：手机上没有 hover。光标相关的交互一律放进 `@media (hover: hover) and (pointer: fine)`（[MDN `hover`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/hover)、[MDN `pointer`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/pointer)），再为触屏单独设计替代方案。Codrops 的 demo 基本以桌面为主，触屏替代要自己做。

### 2.1 大标题排版索引 + 封面跟随光标
- Codrops *Image Reveal Hover Effects*：文字链接悬停时用多种方式显出缩略图。文章 <https://tympanus.net/codrops/2018/11/27/image-reveal-hover-effects/>，源码 <https://github.com/codrops/ImageRevealHover>
- Codrops *Image Trail Effects*：鼠标拖出一串跟随的图片。文章 <https://tympanus.net/codrops/2019/08/07/image-trail-effects/>，源码 <https://github.com/codrops/ImageTrailEffects>。对“安静”的外壳来说太吵，更适合 Hotline Miami 专属页。
- Codrops *RapidImageHoverMenu*：菜单项逐个弹出图片 <https://github.com/codrops/RapidImageHoverMenu>
- Codrops *FullscreenHoverLoop*：悬停菜单项时整屏背景换成对应图片 <https://github.com/codrops/FullscreenHoverLoop>
- Codrops *LinesToLayout*：先是一行行排版文字加行内小图，点击后切换成大图详情 <https://github.com/codrops/LinesToLayout>。适合做“标题索引 → 记录”的转场。
- Codrops *HoverPreviewMiniMap*：悬停预览，旁边一张小地图标出光标位置 <https://github.com/codrops/HoverPreviewMiniMap>
- 不带图的纯排版索引：Feltron <https://feltron.com/>
- **手机端建议**：改成“滚到视口中线的那一行，封面自动淡入”（用 IntersectionObserver），或者点按一次展开行内封面、再点一次进入。

### 2.2 一作一屏 + scroll snap
- MDN scroll snap 指南 <https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll_snap>；[`scroll-snap-type`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-snap-type)；[`scroll-snap-stop`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-snap-stop)（设为 `always` 时，快速滑动也不会跳过作品）。
- Chrome 129 起有 `scrollsnapchange` / `scrollsnapchanging` 事件 <https://developer.chrome.com/blog/scroll-snap-events>，可以在吸附到某部作品时切换页面主色（从封面提取的颜色）或**背景音乐**，不用自己拿 IntersectionObserver 去猜。
- CSS 滚动驱动动画：MDN <https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations>、[`animation-timeline`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline)；示例合集 <https://scroll-driven-animations.style/>
- Codrops *FullscreenScroll*（GSAP Observer 驱动的全屏滚动幻灯）<https://github.com/codrops/FullscreenScroll>
- **手机端**：这是最适合手机的模式。高度用 `100dvh`，避免地址栏伸缩造成跳动。

### 2.3 时间线
- Experimental Jetset 档案的“年代序”栏 <https://www.jetset.nl/>：用纯表格做的时间线，克制。
- Feltron 首页把年份和项目混排在同一段文字里 <https://feltron.com/>，等于一条“排版里的时间线”。
- Knight Lab TimelineJS <https://timeline.knightlab.com/>：外观很通用，只建议参考它的数据结构（起止日期、不精确日期），不建议用它的样式。
- Codrops *Blueprint-VerticalTimeline*（较老，响应式竖向时间线）<https://github.com/codrops/Blueprint-VerticalTimeline>
- **手机端**：竖向单列，日期放在左侧窄栏。日期不详的记录统一归到末尾的“很久以前”。

### 2.4 可拖拽的自由画布
- Codrops *ImageDraggingEffects* <https://github.com/codrops/ImageDraggingEffects>
- Codrops *DraggableImageStrip*（可拖动的图片条，带内容预览）<https://github.com/codrops/DraggableImageStrip>
- Codrops *DraggableMenu*（拖动菜单，带缩略网格预览）<https://github.com/codrops/DraggableMenu>
- 底层 API：MDN Pointer Events <https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events>（一套代码同时处理鼠标和触摸）。
- **手机端**：画布要用 `touch-action: none` 才能拖，这会和页面滚动冲突。建议画布只占一屏，并提供一个“列表视图”开关（参考 Elisa Breyer Archive 的视图切换）。

### 2.5 杂志跨页式构图（底层有网格，版式由数据自动选择）
- Jen Simmons Labs <https://labs.jensimmons.com/>：用 CSS Grid 做杂志版式的经典实验集。
- MDN Grid <https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout>、Subgrid <https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Subgrid>、Container Queries <https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries>：用容器查询让同一个“跨页”组件按可用宽度和内容（有没有语录、有没有长评、封面是横是竖）自动换版式。
- Every Layout <https://every-layout.dev/>：一套“算法式”布局原语（Stack、Sidebar、Switcher 等）。“由数据自动选版式”可以落地为：先按记录的字段组合选出一个原语组合。
- Codrops *AnimatedGridLayout*（杂志式响应布局）<https://github.com/codrops/AnimatedGridLayout>、*PageFlipLayout*（杂志版式加翻页）<https://github.com/codrops/PageFlipLayout>、*PreviewContentTransition*（摘要展开成整页，面向杂志/博客）<https://github.com/codrops/PreviewContentTransition>
- **手机端**：跨页在 375px 宽度下塌成单栏，但保留“一大一小”的对比，例如封面满宽、我的声音缩进一格小字。

### 2.6 叠放卡堆
- Codrops *3DStackMotion*（滚动时的 3D 卡堆）<https://github.com/codrops/3DStackMotion>
- Codrops *MenuThumbStackAnimation*（竖向图片堆展开成一排）<https://github.com/codrops/MenuThumbStackAnimation>
- Codrops *ContentLayoutTransition*（图片堆变成画廊）<https://github.com/codrops/ContentLayoutTransition>
- Codrops *PolaroidStackGrid*（拍立得堆散开成网格，适合 midwest emo 的家庭照片感）<https://github.com/codrops/PolaroidStackGrid>
- Codrops *CardStackEffects* <https://github.com/codrops/CardStackEffects>
- 纯 CSS 做法：多张卡片都设 `position: sticky` 和相同的 `top`，滚动时自然叠起来（[MDN `position`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position)）。
- **手机端**：用 sticky 叠放比拖拽更稳，卡片宽度用 `min(100% - 32px, …)`。

---

## 3. 视觉语言来源

### 3.1 Post-punk / Factory Records / Peter Saville
- *Power, Corruption & Lies*（New Order，1983）<https://en.wikipedia.org/wiki/Power,_Corruption_%26_Lies>：封面复制了 Fantin-Latour 的油画 *A Basket of Roses*，配上 Saville 设计的**模块化色彩编码字母**（英国原版封面上不印乐队名和专辑名）。词条原文强调了“浪漫的静物”和“编码化排版”之间的反差。这正对应本站的两种声音：作品的声音（封面）热烈具象，我的声音（排版）冷静、有编码感。从封面提取主色，也可以看作一种“色彩编码”。
- *Unknown Pleasures*（Joy Division，1979）<https://en.wikipedia.org/wiki/Unknown_Pleasures>：Saville 设计，黑底白线，画面是脉冲星 CP 1919 连续射电脉冲的强度图（ridgeline plot），取自 *Cambridge Encyclopaedia of Astronomy*。图像来源的考证见 Scientific American <https://www.scientificamerican.com/blog/sa-visual/pop-culture-pulsar-origin-story-of-joy-division-s-unknown-pleasures-album-cover-video/>。可借鉴：用一张“数据图”当封面，例如把完成日期或类别分布画成 ridgeline。
- Peter Saville 维基 <https://en.wikipedia.org/wiki/Peter_Saville_(graphic_designer)>
- petersaville.info <https://petersaville.info/>：日本爱好者 tosq 维护的 Saville 唱片封面全目录（非官方），可按封面逐张浏览。
- Factory Records 目录（Cerysmatic Factory）<https://factoryrecords.org/>：按 FAC 编号列出 Factory 及其子厂牌的全部出品。可借鉴的是“给每一样东西编号”的厂牌习惯，可以用在**我的声音**里，例如每条记录一个目录号，跨页面统一。
- Factory Benelux 官方 <https://www.factorybenelux.com/>
- V&A 馆藏中的 Saville 作品 <https://collections.vam.ac.uk/search/?q=peter%20saville>；Design Museum <https://designmuseum.org/>
- 同一脉络的厂牌视觉：Sacred Bones（统一的封面版式系统）<https://www.sacredbonesrecords.com/>；ECM Records（安静的摄影封面）<https://ecmrecords.com/>；4AD <https://www.4ad.com/>（会跳到美国商店页）。

### 3.2 Midwest emo 专辑美术（照片颗粒、家常的忧郁）
- American Football LP1（1999，Polyvinyl）<https://en.wikipedia.org/wiki/American_Football_(1999_album)>：封面是一栋房子的上半部，楼上一盏灯亮着。房子在 Urbana, Illinois 的 704 W. High St，后来成了乐迷拍照的地标；2014 年的 “Never Meant” MV 由 Chris Strong 执导，就在这栋房子内外拍摄。可借鉴：低饱和、日常、窗口的光、留白很多的单张照片。
- American Football Bandcamp <https://americanfootball.bandcamp.com/>；Polyvinyl <https://www.polyvinylrecords.com/>、<https://polyvinylrecords.bandcamp.com/>
- Cap'n Jazz Bandcamp <https://capnjazz.bandcamp.com/>（Kinsella 兄弟早期乐队，手写拼贴式美术）；Jade Tree <https://jadetree.com/>（90 年代 emo 厂牌）。
- 颗粒的实现：CSS-Tricks *Grainy Gradients* <https://css-tricks.com/grainy-gradients/>；MDN `feTurbulence` <https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence>

### 3.3 日本编辑 / CD 歌词本排版
- W3C《日文排版需求》JLReq <https://www.w3.org/TR/jlreq/>：禁则、约物、竖排、ルビ的权威规范。
- W3C《中文排版需求》CLReq <https://www.w3.org/TR/clreq/>
- 竖排：MDN `writing-mode` <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/writing-mode>；竖排里的数字或年份横排（完成日期很常用）：MDN `text-combine-upright` <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-combine-upright>
- 原名注音：MDN `<ruby>` <https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/ruby>
- 断行与间距（Chrome 官方博客）<https://developer.chrome.com/blog/css-i18n-features>：
  - `word-break: auto-phrase`：Chrome 119 起支持，目前只对日文生效，用的是 BudouX，按自然短语断行，适合**日文原名**大标题。属性本身见 MDN <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/word-break>。
  - `text-autospace`：自动给中日文与拉丁字母之间加间距，MDN 标注为 Baseline 2025 <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-autospace>
  - `text-spacing-trim`：CJK 标点挤压，MDN 标注为 Limited availability <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-spacing-trim>
  - 需要跨浏览器时，可以在构建时用 BudouX 把短语切好 <https://github.com/google/budoux>
- 日本平面设计与杂志：IDEA 杂志 <https://www.idea-mag.com/>；Tokyo TDC <https://tokyotypedirectorsclub.org/>；BRUTUS <https://brutus.jp/>
- J-pop 官网：ヨルシカ <https://yorushika.com/>；ZUTOMAYO <https://zutomayo.net/>；REISSUE RECORDS（米津玄師）<https://reissuerecords.net/>

### 3.4 视觉小说 UI（文本框 / backlog）
- Ren'Py 文档 *Dialogue History*（即 backlog）<https://www.renpy.org/doc/html/history.html>：每一句台词显示后都存进历史，可以回看。→ 视觉小说**类别页**可以做成一份“backlog”：每条记录就是历史里的一句台词，上面是原名，下面是短评。
- Ren'Py *NVL mode*（整屏文字模式）<https://www.renpy.org/doc/html/nvl_mode.html>：→ 长评或语录的全屏阅读形态，很接近歌词本。
- Ren'Py *Screens* <https://www.renpy.org/doc/html/screens.html>、*Special Screens*（say 文本框、选项菜单等）<https://www.renpy.org/doc/html/screen_special.html>

### 3.5 动画标题卡与字幕
- Fontworks *マティス EB*（Matisse EB）字体页 <https://fontworks.co.jp/fontsearch/matissepro-eb/>：《新世纪福音战士》标题卡那种极粗明朝体的出处；同一系列有 L / M / DB / B / EB / UB 六个字重。适合做**专属页**的标题卡式间幕。
- 福音战士官网 <https://www.evangelion.jp/>；〈物語〉系列门户（SHAFT 的纯文字标题卡风格）<https://www.monogatari-series.com/>
- 字幕：ASS 字幕渲染库 libass <https://github.com/libass/libass>、Aegisub <https://aegisub.org/>（源码 <https://github.com/TypesettingTools/Aegisub>）。卡拉 OK 逐字高亮可以参考来给**语录**或歌词做逐字动画。

### 3.6 Hotline Miami（第一个专属页）
- Devolver 官方页：*Hotline Miami* <https://www.devolverdigital.com/games/hotline-miami>、*Hotline Miami 2: Wrong Number* <https://www.devolverdigital.com/games/hotline-miami-2-wrong-number>
- Steam：HM1 <https://store.steampowered.com/app/219150/>、HM2 <https://store.steampowered.com/app/274170/>（会先跳到年龄验证页）
- 维基 <https://en.wikipedia.org/wiki/Hotline_Miami>：Dennaton Games（Jonatan Söderström、Dennis Wedin）开发，背景是 1989 年的 Miami，**封面美术由 Niklas Åkerblad 绘制**。他即 El Huervo，也参与了原声：<https://elhuervo.bandcamp.com/>
- OST 代表音乐人 Perturbator <https://perturbator.bandcamp.com/>（synthwave 封面视觉）
- 效果实现：Codrops *CSSGlitchEffect*（clip-path 故障效果）<https://github.com/codrops/CSSGlitchEffect>、*GlitchSlideshow* <https://github.com/codrops/GlitchSlideshow>；VHS 抖动和撕裂用 MDN `feDisplacementMap` <https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap>；逐字标题动画用 Codrops *TextCharacterAnimations*（2026，含 WebGL 版本）<https://github.com/codrops/TextCharacterAnimations>

---

## 4. 字体

### 4.1 按用途推荐

**(a) 安静的正文**
- Noto Serif SC / Noto Serif JP（Google Fonts）<https://fonts.google.com/noto/specimen/Noto+Serif+SC>、<https://fonts.google.com/noto/specimen/Noto+Serif+JP>；源码 <https://github.com/notofonts/noto-cjk>。实测 Google 的 CSS 把**单个字重**切成很多个 `unicode-range` 分片：Noto Serif JP 400 有 **124** 个 `@font-face`，Noto Serif SC 400 有 **101** 个。浏览器只下载页面实际用到的分片。
- Noto Sans SC <https://fonts.google.com/specimen/Noto+Sans+SC>
- 思源宋体 / 思源黑体（Adobe）<https://github.com/adobe-fonts/source-han-serif>、<https://github.com/adobe-fonts/source-han-sans>。最新 release 2.003R 里 SC 子集的 zip 约 132 MB，必须切片后才能上网页。
- 霞鹜新致宋（衍生自 IPAex / IPAmj 明朝，按大陆规范字形改造，收约 2.2 万字）<https://github.com/lxgw/LxgwNeoZhiSong>：`LXGWNeoZhiSong.ttf` 9.9 MB。日系明朝的骨架配中文字形，和日文原名放在一起很协调。
- 霞鹜新晰黑 <https://github.com/lxgw/LxgwNeoXiHei>：`LXGWNeoXiHei.ttf` 7.1 MB

**(b) 我的声音（短评、语录、完成日期、心头好标记）**
- **霞鹜文楷** <https://github.com/lxgw/LxgwWenKai>：README 写明它“基于 FONTWORKS 出品字体 Klee One 衍生”。v1.530 的 `LXGWWenKai-Regular.ttf` 24.7 MB。有轻便版 <https://github.com/lxgw/LxgwWenKai-Lite> 和繁体 TC 版 <https://github.com/lxgw/LxgwWenKaiTC>（单字重约 14.6 MB）。
- **Klee One**（Fontworks，Google Fonts）<https://fonts.google.com/specimen/Klee+One>；Fontworks 开源字体组织 <https://github.com/fontworks-fonts>、Klee 仓库 <https://github.com/fontworks-fonts/Klee>
- **关键点**：霞鹜文楷和 Klee One 出自同一母本。我的声音用中文写时用文楷，引用日文语录时用 Klee One，两者笔形一致，“我的声音在每一页都一样”在中日混排里也能成立。
- 现成的切片 webfont 包 lxgw-wenkai-webfont <https://github.com/chawyehsu/lxgw-wenkai-webfont>：提供 `lxgw-wenkai-webfont`、`-lite-`、`-tc-`、`-screen-` 几个 npm 包，`@import '…/style.css'` 后即可使用。Screen 版是为屏幕阅读优化的版本。
- 朱雀仿宋 <https://github.com/TrionesType/zhuque>：v0.212 的 zip 5.4 MB。仿宋的日记感、手抄感，可以作为我的声音的备选。

**(c) 日文原名**
- Shippori Mincho <https://fonts.google.com/specimen/Shippori+Mincho>（源码 <https://github.com/fontdasu/ShipporiMincho>）：偏传统书籍的明朝体，适合歌词本、内页的气质。
- Zen Old Mincho <https://fonts.google.com/specimen/Zen+Old+Mincho>、Hina Mincho <https://fonts.google.com/specimen/Hina+Mincho>
- BIZ UDPMincho（Morisawa）<https://fonts.google.com/specimen/BIZ+UDPMincho>，源码 <https://github.com/googlefonts/morisawa-biz-ud-mincho>
- 无衬线：Zen Kaku Gothic New <https://fonts.google.com/specimen/Zen+Kaku+Gothic+New>、IBM Plex Sans JP <https://fonts.google.com/specimen/IBM+Plex+Sans+JP>（源码 <https://github.com/IBM/plex>）、M PLUS 系列 <https://github.com/coz-m/MPLUS_FONTS>

**(d) 表现性标题（类别页、专属页）**
- 日文：Dela Gothic One <https://fonts.google.com/specimen/Dela+Gothic+One>（极粗，接近标题卡）；Fontworks 开源的 Rampart One <https://fonts.google.com/specimen/Rampart+One>、Reggae One <https://fonts.google.com/specimen/Reggae+One>、Train One <https://fonts.google.com/specimen/Train+One>、Stick <https://fonts.google.com/specimen/Stick>；毛笔系 Yuji Syuku <https://fonts.google.com/specimen/Yuji+Syuku>；装饰明朝 Kaisei Decol <https://fonts.google.com/specimen/Kaisei+Decol>、Zen Antique <https://fonts.google.com/specimen/Zen+Antique>
- 中文：得意黑 Smiley Sans <https://github.com/atelier-anchor/smiley-sans>（v2.0.1 zip 5.5 MB，斜体窄黑，适合有速度感的标题）；站酷小薇 <https://fonts.google.com/specimen/ZCOOL+XiaoWei>；站酷庆科黄油体 <https://fonts.google.com/specimen/ZCOOL+QingKe+HuangYou>；手写 / 书法：Zhi Mang Xing <https://fonts.google.com/specimen/Zhi+Mang+Xing>、Long Cang <https://fonts.google.com/specimen/Long+Cang>、Ma Shan Zheng <https://fonts.google.com/specimen/Ma+Shan+Zheng>
- 拉丁字（混排）：Instrument Serif <https://fonts.google.com/specimen/Instrument+Serif>、EB Garamond <https://fonts.google.com/specimen/EB+Garamond>、IBM Plex Mono <https://fonts.google.com/specimen/IBM+Plex+Mono>（目录号、日期这类数字）
- 标题卡参照：Fontworks マティス EB <https://fontworks.co.jp/fontsearch/matissepro-eb/>（Fontworks 官网 <https://fontworks.co.jp/>）

### 4.2 子集化与切片

- **Google Fonts 自动切片**：直接引用 CSS2 API 即可，CJK 会被自动按 `unicode-range` 切成上百片（实测数字见 4.1）。另外 `text=` 参数只返回指定字符的字体文件，官方文档 <https://developers.google.com/fonts/docs/css2> 的 “Optimizing your font requests” 一节有说明。实测 `family=Noto+Serif+JP&text=東方` 返回的 `@font-face` 只含 `unicode-range: U+65b9, U+6771`。这很适合**原名**大标题或**专属页**标题：只传标题里的字符。
- **cn-font-split / 中文网字计划**：<https://github.com/KonghaYao/cn-font-split>、<https://chinese-font.netlify.app/>（在线切割 <https://chinese-font.netlify.app/zh-cn/online-split/>）。7.0 版用 Rust / WASM 重写，README 称“2MB 字体只需要 50ms”。支持 Node、Bun、Deno 和浏览器，支持可变字体，并提供 `vite-plugin-font`（Vite、Nuxt、Next、Webpack、Rspack）。基本用法是 `await fontSplit({ input: buffer, outDir: './dist/font' })`，按字频智能分包并输出带 `unicode-range` 的 CSS。中文网字计划还维护着已切好的免费字体仓库 <https://github.com/KonghaYao/chinese-free-web-font-storage>。
- **构建期精确子集**（最省流量，适合原名和标题字体）：在构建时收集所有记录的原名和语录文本，生成字符清单，再用 fontTools `pyftsubset --text-file=…` 生成 woff2：<https://fonttools.readthedocs.io/en/latest/subset/>。也可以用 glyphhanger 爬取页面统计实际用字：<https://github.com/zachleat/glyphhanger>
- **原理与规范**：MDN `unicode-range` <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face/unicode-range>；MDN `size-adjust`（让回退字体对齐尺寸，减少换字时的跳动）<https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face/size-adjust>；web.dev 字体优化 <https://web.dev/learn/performance/optimize-web-fonts>；W3C Incremental Font Transfer（下一代按需传输字形的规范）<https://www.w3.org/TR/IFT/>
- **Astro 内置字体 API**（Astro 6 已转正，原 experimental 文档地址现已重定向）<https://docs.astro.build/en/guides/fonts/>：内置 Adobe、Bunny、Fontshare、Fontsource、Google、NPM 和本地文件等 provider；`<Font cssVariable="…" preload />` 组件；配置项有 `font.subsets`（Astro 6.0 新增）和 `font.unicodeRange`，见 <https://docs.astro.build/en/reference/configuration-reference/>。Fontsource <https://fontsource.org/>（<https://github.com/fontsource/fontsource>）
- **建议组合**：正文走 Google Fonts 或 Fontsource 的自动切片；我的声音用 `lxgw-wenkai-screen-webfont`，或者自己用 cn-font-split 切霞鹜文楷；原名和专属页标题在构建期按实际字符做精确子集，每个标题字体只有几十 KB。

---

## 5. 技术参考（官方文档）

### 5.1 Astro `<ClientRouter />` 与 `transition:persist`（跨页面保活播放器）
文档：<https://docs.astro.build/en/guides/view-transitions/>；API 参考：<https://docs.astro.build/en/reference/modules/astro-transitions/>
- 在共享 layout 的 `<head>` 里 `import { ClientRouter } from "astro:transitions"` 并加上 `<ClientRouter />`。
- `transition:persist`：文档原例就是一个 `<video controls muted autoplay transition:persist>`，导航到**同样包含这个元素**的页面时会继续播放，前进和后退都有效。它也可以带名字：`transition:persist="media-player"`。
- **关键约束**：swap 流程里“标了 `transition:persist` 的元素，只有在新页面也存在时才会被搬过去”。所以播放器必须放在**每一页**都用到的外壳 layout 里，**专属页**也不例外，否则一跳过去音乐就断。
- 岛组件加 `transition:persist-props` 后，props 也保持不变、不重渲染。适合播放器岛：页面换了，它不跟着接收新 props。
- 限制：文档明确说“CSS 动画的重启和 iframe 的重新加载无法避免”。所以不要用 iframe 嵌播放器，播放器上的 CSS 动画也会重播。
- 脚本：打包的 module script 只执行一次；每页都要运行的初始化写在 `astro:page-load` 里，绘制前要做的事写在 `astro:after-swap` 里。生命周期依次是 `astro:before-preparation`、`astro:after-preparation`、`astro:before-swap`、`astro:after-swap`、`astro:page-load`。背景音乐的淡出、淡入可以挂在 `before-preparation` 和 `page-load` 上。
- 注意：`data-astro-reload` 会强制整页刷新，播放器随之销毁。站内链接不要用它。
- `<ClientRouter />` 自带针对 `prefers-reduced-motion` 的媒体查询，检测到这个设置时禁用所有转场动画，直接换 DOM。

### 5.2 浏览器自动播放策略（进入页的依据）
- Chrome 官方 <https://developer.chrome.com/blog/autoplay>：静音自动播放总是允许；有声播放需要满足条件之一，例如用户已经和这个域名交互过（点击、轻触等），或者桌面端的 Media Engagement Index 足够高。没有用户手势就调用 `play()` 时，Promise 会以 `NotAllowedError` 拒绝。在用户手势之前创建的 `AudioContext` 处于 `suspended` 状态，需要在用户交互后调用 `resume()`。
- MDN 自动播放指南 <https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay>：`navigator.getAutoplayPolicy("mediaelement" | "audiocontext")` 或传入某个元素，会返回 `allowed` / `allowed-muted` / `disallowed`（API 页 <https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getAutoplayPolicy>）。Web Audio 的播放受 sticky activation 约束。
- 用户激活（sticky / transient activation）：MDN <https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/User_activation>
- **对本站的含义**：**进入页**上的一次点击，就是“开声音”的那个用户手势。之后 ClientRouter 的站内导航不会刷新文档，激活状态和 `<audio>` 元素都保留下来。刷新或新开标签页会重新出现进入页，这和词汇表里“每次访问第一次打开时出现”一致。可以先用 `getAutoplayPolicy` 探测，如果已经是 `allowed`（例如 MEI 很高），进入页可以从简。
- 淡入淡出与锁屏控制：MDN Web Audio API <https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API>、`AudioParam.linearRampToValueAtTime` <https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/linearRampToValueAtTime>；Media Session API（手机锁屏、通知栏显示曲名和封面）<https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API>
- 页面转场本身：MDN View Transition API <https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API>、`@view-transition` <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@view-transition>

### 5.3 OGL（只用于首页 hero 与专属页）
- 仓库 <https://github.com/oframe/ogl>，示例 <https://oframe.github.io/ogl/examples/>
- README 自述：“Minimal WebGL library”，零依赖 ES modules，API 与 three.js 相似但抽象层更薄。体积（min+gzip）：Core 8kb、Math 6kb、Extras 15kb，合计 29kb，tree-shaking 后更小。适合写颗粒、VHS、霓虹之类的自定义 shader。

### 5.4 `prefers-reduced-motion`
- MDN <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion>
- Astro ClientRouter 已自动处理转场（见 5.1）。标题字效、光标跟随、OGL 动画需要自己降级：静止帧或淡入。

### 5.5 构建期从封面提取主色（Node）
- **sharp `stats()`** <https://sharp.pixelplumbing.com/api-input/>（仓库 <https://github.com/lovell/sharp>）：返回值里的 `dominant` 是“基于 4096 格 3D 直方图得出的最主要 sRGB 颜色”，用法是 `const { dominant: { r, g, b } } = await sharp(input).stats()`。文档提醒：统计基于**原始输入**，如果要统计 resize 或裁剪之后的结果，需要先输出成 buffer 再调用 stats。
- **node-vibrant** <https://github.com/Vibrant-Colors/node-vibrant>：`import { Vibrant } from "node-vibrant/node"`，`getPalette()` 返回一组 swatch（Vibrant、Muted 系列），适合拿到“主色 + 强调色 + 暗色”三件套。README 提醒结果可能随平台和机器不同而略有差异，所以应该**在构建时算一次并写进数据文件**，不要每次都现算。
- fast-average-color-node（平均色）<https://github.com/fast-average-color/fast-average-color-node>；Color Thief <https://github.com/lokesh/color-thief>
- 接入位置：Astro 图片 <https://docs.astro.build/en/guides/images/>、内容集合 <https://docs.astro.build/en/guides/content-collections/>。可以在内容 loader 或一个预构建脚本里给每条记录补上 `colors` 字段。

---

## 建议优先看（首页原型用）

1. **Feltron 首页** <https://feltron.com/>：首页 A 的现成样本，作品名就是链接，一段字就是一个人。
2. **Laurel Schwulst 的站和文章** <https://laurelschwulst.com/>、<https://thecreativeindependent.com/essays/laurel-schwulst-my-website-is-a-shifting-house-next-to-a-river-of-knowledge-what-could-yours-be/>：大字导航配私人小字条目，以及“网站即住所、即自画像”的论述。
3. ***Power, Corruption & Lies* 封面** <https://en.wikipedia.org/wiki/Power,_Corruption_%26_Lies>（配合 <https://petersaville.info/> 浏览全部封面）：浪漫的图像配上冷静的编码排版，正好是作品的声音和我的声音的关系。
4. **霞鹜文楷 + Klee One** <https://github.com/lxgw/LxgwWenKai>、<https://fonts.google.com/specimen/Klee+One>：两者同一母本，先把“我的声音”的字体定下来，首页的三个候选才能放在一起比较。
5. **Codrops Image Reveal Hover + Astro view transitions** <https://tympanus.net/codrops/2018/11/27/image-reveal-hover-effects/>、<https://docs.astro.build/en/guides/view-transitions/>：前者用来做“作品名悬停显出封面”的交互，后者用来让进入页和常驻播放器在首页原型里就跑通。

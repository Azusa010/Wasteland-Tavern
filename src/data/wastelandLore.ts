export type LoreCategory =
  | "GEOGRAPHY"
  | "FACTIONS"
  | "DRINKS_ECONOMY"
  | "CREATURES_HAZARDS"
  | "FIGURES_SECRETS";

export interface WastelandLoreEntry {
  id: string;
  code: string;
  category: LoreCategory;
  title: string;
  summary: string;
  detail: string;
  detectiveHint: string;
  unlockHint: string;
  unlockedByDefault: boolean;
  keywords: string[];
  relatedFactions?: string[];
  restrictedToNpcIds?: string[];
}

export const LORE_CATEGORY_META: Record<
  LoreCategory,
  { label: string; shortLabel: string; code: string }
> = {
  GEOGRAPHY: { label: "地理与废墟扇区", shortLabel: "地理", code: "GEO" },
  FACTIONS: { label: "阵营与江湖势力", shortLabel: "势力", code: "FAC" },
  DRINKS_ECONOMY: { label: "酒单与瓶盖物价", shortLabel: "酒单", code: "ECO" },
  CREATURES_HAZARDS: { label: "异兽与核冬天灾", shortLabel: "生态", code: "HAZ" },
  FIGURES_SECRETS: { label: "秘闻与暗线铁律", shortLabel: "秘闻", code: "SEC" },
};

/**
 * 每次对话必带的核心世界观铁律底座（精炼高密度，彻底杜绝酒单/物价/时代穿帮，同时保留纯正《辐射》式废土致敬质感）
 */
export const CORE_WORLD_CANON_PROMPT = `【《废土酒馆》核心世界观铁律（所有台词必须严格对齐，严禁穿帮）】
1. 纪元与坐标：核战「大静默（The Great Flash）」后第 87 年，核冬未散。本酒馆坐落于「灰烬裂谷·零号街区（Sector-0）」，由战前 07 号民防防空洞改建（重型铆钉防爆齿轮门、水泥波纹铁皮墙、破损霓虹灯牌与门廊铜铃），是方圆十里唯一亮着钨丝暖灯的中立落脚点。
2. 货币与真实物价锚点：全荒原以战前冲压铁皮「瓶盖（Caps）」为唯一硬通货。物价铁律：店内一杯特调酒售价 11～18 瓶盖，战地包扎或一顿热食约 8 瓶盖，散播口风润喉费 6 瓶盖，追缉暗探悬赏金约 24～36 瓶盖，100 瓶盖已是足以买命的巨款（严禁随口说出几百上千瓶盖的失真数字）。
3. 本店唯一真实原料与酒单（严禁点现代洋酒）：
   - 吧台仅有 6 种废土原料：「蒸馏辐射水」「变异土豆原浆」「铁锈烘麦芽」「幽光菌菇露」「荒原安神草」「核冬冰薄荷」。
   - 5 款招牌特调：《铁锈烧刀子》(14盖·土豆原浆+麦芽·辛辣烈酒)、《废墟暖胃甜麦饮》(11盖·辐射水+土豆+麦芽·温和饱腹)、《荧光净辐冷萃》(18盖·辐射水+菌菇+冰薄荷·净辐降温)、《商队金算盘特调》(17盖·麦芽+菌菇+安神草·奇异微甜)、《荒原安魂曲》(16盖·辐射水+安神草+冰薄荷·草本镇静)。
   - 严禁向老板点“威士忌、伏特加、龙舌兰、朗姆酒、红酒、精酿啤酒、拿铁”等战前现代饮品！可自然提及废土经典风物（如早已停产只剩瓶盖流通的「核子汽水 Nuka-Pop」、腕式荧光绿屏终端「哔哔小子」、盖革计数器、抗辐宁、双头驼兽、战前避难所连体服），若怀念战前好酒，只能感叹早绝迹了并改点本店的烧刀子或麦饮。
4. 昼夜法则：白昼酒馆开门迎客；黄昏拉下铁皮卷帘门结账；黑夜酒馆老板会亲自提枪潜入东区三层废墟（1层坍塌高架商道、2层暗巷与隐藏医药冷藏室、3层极寒储藏室）与灰烬巨鼠、掠夺者及重甲巨钳兽搏命搜刮次日调酒食材。`;

export const WASTELAND_LORE_DB: readonly WastelandLoreEntry[] = [
  {
    id: "lore_sector_zero",
    code: "GEO-01",
    category: "GEOGRAPHY",
    title: "零号街区与 07 号防空洞酒馆",
    summary: "铁锈十字路口旁的半地下战前民防掩体，立有「进门卸枪栓」的铁规。",
    detail:
      "零号街区位于灰烬裂谷交通咽喉「铁锈十字路口」西侧。酒馆原本是战前市政 07 号防空掩体，保留了厚重的圆形观察窗防爆铁门与波纹钢护墙。前任老掌柜在门楣挂起黄铜迎客铃，立下「进门卸弹匣、吧台不问出身、欠账按手印」三条老规矩，如今由现任老板接手经营。",
    detectiveHint:
      "常在零号街区活动的真熟客都认得防爆门上的旧弹痕与铜铃规矩；连零号街区方位都说错的外来客往往怀有鬼胎。",
    unlockHint: "初始收录于酒保开张手记",
    unlockedByDefault: true,
    keywords: [
      "零号街区",
      "酒馆",
      "防空洞",
      "防爆门",
      "老掌柜",
      "规矩",
      "铁锈十字路口",
      "这地方",
      "开店",
    ],
  },
  {
    id: "lore_ruins_layers",
    code: "GEO-02",
    category: "GEOGRAPHY",
    title: "东区三层废墟与极寒储藏室",
    summary: "酒保每晚潜入搜刮原料的三层险地：坍塌商道、医药冷库与底层巨钳兽巢。",
    detail:
      "从酒馆后巷暗门向东便是夜间拾荒主扇区：第一层为坍塌高架桥商道，常有灰烬巨鼠与游荡拾荒贼；第二层深入战前商业街窄巷，藏有需熟客暗号才能绕开电网的「高产生物医药冷藏室」（盛产幽光菌菇与安神草）；第三层直抵地底低温冷却反应室，结满珍稀的核冬冰薄荷，但盘踞着霸主「深层重甲巨钳兽」。",
    detectiveHint:
      "信任度达标的常客透露的密道暗号可直接在黑夜第 2 层点亮无伤高产医药冷藏室。",
    unlockHint: "初始收录于酒保夜探地图",
    unlockedByDefault: true,
    keywords: [
      "东区",
      "废墟",
      "三层",
      "高架桥",
      "冷藏室",
      "冷库",
      "极寒",
      "储藏室",
      "夜里",
      "搜刮",
      "密道",
      "情报",
    ],
  },
  {
    id: "lore_shipyard_subway",
    code: "GEO-03",
    category: "GEOGRAPHY",
    title: "废铁船坞与地下铁暗渠",
    summary: "干涸运河边的重工拆船厂，地底连通着废弃地铁网与秘密净水站。",
    detail:
      "零号街区以南三里是干涸运河上的「废铁船坞」，聚集着背高压焊枪气瓶的重工拆解工，专靠切割战前驳船钢板换取瓶盖。船坞下方则是错综复杂的战前地下铁隧道，不仅生长着耐辐射菌落，还盛传藏有一条专门协助失控合成人抹除追踪信标的地下安全通道。",
    detectiveHint:
      "自称船坞焊工的客人理应熟悉液压钳、铅板除锈与运河焊渣；若对重工活计一问三不知，极可能是冒名暗探。",
    unlockHint: "与客人聊及「船坞」「焊工」或「地下铁」时自动收录",
    unlockedByDefault: false,
    keywords: [
      "船坞",
      "废铁船坞",
      "重工",
      "焊工",
      "液压钳",
      "地下铁",
      "地铁",
      "隧道",
      "净水站",
      "运河",
    ],
    relatedFactions: ["废铁船坞重工组", "拾荒者互助网"],
  },
  {
    id: "lore_vault_relics",
    code: "GEO-04",
    category: "GEOGRAPHY",
    title: "战前避难所遗址与哔哔小子终端",
    summary: "灰烬裂谷深处散落着编号避难所遗物，蓝金连体服与荧光绿腕表皆系出同源。",
    detail:
      "核战前夕建造的多座地下封闭避难所（如早已停摆的 109 号农业实验避难所与 74 号低温掩体）散落在裂谷北麓。如今偶有身穿修身蓝金连体服的避难所后裔或技术遗民踏入荒原；而酒馆吧台左侧镶嵌的那台军绿钢壳荧光绿 CRT「哔哔小子」改装座机，正是老掌柜当年用三箱烧刀子从避难所技师手里换来的镇店宝贝。",
    detectiveHint:
      "哔哔小子不仅能监控酒馆耐久与瓶盖账目，其短波模块每天清晨还能自动截获各方势力的加密通缉电报。",
    unlockHint: "提及「避难所」「哔哔小子」「蓝金服」或「电报」时收录",
    unlockedByDefault: false,
    keywords: [
      "避难所",
      "109",
      "74",
      "蓝金",
      "连体服",
      "哔哔小子",
      "终端",
      "战前",
      "电报",
      "短波",
    ],
  },
  {
    id: "lore_scavenger_net",
    code: "FAC-01",
    category: "FACTIONS",
    title: "灰烬拾荒者互助网",
    summary: "底层拾荒客抱团取暖的松散行会，靠墙角粉笔符号传递生死情报。",
    detail:
      "没有武装靠山的独行拾荒客们在零号街区自发结成的互助圈，阿灰是其中口碑极佳的年轻老手。他们用特制荧光粉笔在废墟断墙上画符号：圆圈代表净水点，交叉骨代表辐射泄漏，锯齿线代表血齿帮埋伏。善待拾荒客的酒馆往往能第一时间收到哪间地下冷库尚未被搜空的真消息。",
    detectiveHint:
      "阿灰极重人情，一杯多倒半杯的《废墟暖胃甜麦饮》足以让她把压箱底的万能撬棍与冷库密道倾囊相授。",
    unlockHint: "初始收录于酒保开张手记",
    unlockedByDefault: true,
    keywords: [
      "拾荒",
      "阿灰",
      "互助",
      "撬棍",
      "粉笔",
      "暗号",
      "淘货",
      "废铁",
    ],
    relatedFactions: ["灰烬裂谷拾荒者", "独行拾荒客"],
  },
  {
    id: "lore_bloodtooth_gang",
    code: "FAC-02",
    category: "FACTIONS",
    title: "血齿掠夺帮（Bloodtooth Raiders）",
    summary: "盘踞东区高架桥的凶悍匪帮，狂犬·巴克曾是其麾下悍将。",
    detail:
      "以涂满红漆的锯齿汽车护甲与双管短猎枪闻名的废土掠夺团伙，常在东区高架桥设卡劫掠过往驼队。「狂犬·巴克」曾是血齿帮二当家，一年前因拒绝执行屠杀避难所流民的命令，打断大当家三根肋骨后叛出帮派，如今独自接黑活护卫谋生，血齿帮至今仍在悬赏他的脑袋。",
    detectiveHint:
      "巴克最恨酒里兑水糊弄或被人拿当年血齿帮的旧账羞辱，危险张力一旦破 75 极易当场掀桌火并；反之喝痛快了会成为夜探最猛的霰弹枪护卫。",
    unlockHint: "初始收录于酒保开张手记",
    unlockedByDefault: true,
    keywords: [
      "血齿",
      "掠夺者",
      "匪帮",
      "巴克",
      "狂犬",
      "霰弹枪",
      "火并",
      "劫道",
      "叛徒",
    ],
    relatedFactions: ["前血齿掠夺帮", "荒原佣兵"],
  },
  {
    id: "lore_data_tower",
    code: "FAC-03",
    category: "FACTIONS",
    title: "中央数据塔与「猎犬」回收队",
    summary: "隐于北境地底的高科技极权机构，制造仿生合成人并派猎犬无情追缉逃亡者。",
    detail:
      "传说继承了战前最高算力实验室的神秘科技组织「中央数据塔」，能培育出与常人无异却嵌有生物神经芯片的第三代合成人，用于渗透荒原聚落收集实验数据。一旦有合成人产生自我意识出逃（如代号 K-7），数据塔便会派出冷血精准的「猎犬（Hounds）」追缉官与伪装线人，沿途排查每一座酒馆。",
    detectiveHint:
      "数据塔暗探往往伪装成测绘员、旧档案员或药商，喜欢打听「举止精密的陌生白发男子」或「冰薄荷与净辐冷萃的去向」。",
    unlockHint: "与 K-7 深谈或截获数据塔追缉线索后收录",
    unlockedByDefault: false,
    keywords: [
      "数据塔",
      "中央数据塔",
      "合成人",
      "仿生",
      "猎犬",
      "回收",
      "芯片",
      "K-7",
      "神经回路",
      "追缉",
    ],
    relatedFactions: ["无阵营流亡者", "中央数据塔"],
  },
  {
    id: "lore_caravan_guild",
    code: "FAC-04",
    category: "FACTIONS",
    title: "自由驼队商会与双头驼铃",
    summary: "驱赶双头驼兽贯通南北聚落的行商同盟，是瓶盖信誉与黑市消息的中枢。",
    detail:
      "荒原上唯一能跨扇区运送净水滤芯、弹药底火与医疗包的大商会，依靠耐辐射的「双头驼兽（Brahmin）」驮运物资。老算盘·莫里是商会派驻铁锈十字路口的老资格分号掌柜。驼队极看重「有借有还」的账本信誉——你若在莫里资金周转不开时准许赊账，下次驼队回城必定连本带利奉还。",
    detectiveHint:
      "商队圈子消息最灵通，托莫里或行商散播酒馆风评往往能迅速改变整条街区的进店口碑。",
    unlockHint: "初始收录于酒保开张手记",
    unlockedByDefault: true,
    keywords: [
      "驼队",
      "商队",
      "商会",
      "莫里",
      "算盘",
      "双头驼",
      "驼铃",
      "赊账",
      "行商",
      "汇率",
    ],
    relatedFactions: ["荒原自由驼队商会"],
  },
  {
    id: "lore_steel_wardens",
    code: "FAC-05",
    category: "FACTIONS",
    title: "废铁秩序团与荒原悬赏令",
    summary: "搜集战前重装科技、维持商道最低限度秩序的准军事巡逻武装。",
    detail:
      "由战前国民警卫队后裔与重甲技师组成的「废铁秩序团」，身披拼焊液压动力胸甲，致力于封存危险战前生化武器并清剿恶性劫道惯犯。秩序团人手有限，故长期通过加密电传向各聚落酒保发布通缉特征电报——只要酒保能催醉识破潜逃重犯，秩序团巡逻哨便会按电报标价痛快兑付瓶盖赏金。",
    detectiveHint:
      "当面拆穿通缉犯虽能立刻领走秩序团赏金并提升酒馆安全度，但被拆穿者的幕后同党当晚极可能在废墟第 2 层买凶报复！",
    unlockHint: "查阅通缉电报或遇到重装巡逻客时收录",
    unlockedByDefault: false,
    keywords: [
      "秩序团",
      "动力甲",
      "巡逻",
      "悬赏",
      "通缉",
      "赏金",
      "猎人",
      "重装",
      "执法",
    ],
  },
  {
    id: "lore_bottle_caps",
    code: "ECO-01",
    category: "DRINKS_ECONOMY",
    title: "冲压瓶盖本位制与核子汽水遗风",
    summary: "战前核子汽水冲压瓶盖因齿纹防伪成为硬通货；本店特调定价 11～18 盖。",
    detail:
      "大静默后纸币化为废纸，自由驼队商会选定战前风靡全国的「核子汽水（Nuka-Pop）」与铁锈麦啤标准 21 齿冲压铁皮瓶盖作为法定通货——因战前压盖生产线早已损毁且油墨特殊，几乎无法私造。在零号街区：1 瓶蒸馏辐射水值 2 盖，一杯招牌特调 11～18 盖，战地军医包扎一次 8 盖，攒够百枚瓶盖足以加固整座防空洞铁门。",
    detectiveHint:
      "遇到张口讨价还价的熟客，压价到 6～8 折属于荒原正常讲价范畴；若一味强硬拒客虽保住单杯利润，却会折损口碑。",
    unlockHint: "初始收录于吧台账本",
    unlockedByDefault: true,
    keywords: [
      "瓶盖",
      "物价",
      "多少钱",
      "核子汽水",
      "汽水",
      "货币",
      "标价",
      "讲价",
      "砍价",
      "便宜",
    ],
  },
  {
    id: "lore_six_ingredients",
    code: "ECO-02",
    category: "DRINKS_ECONOMY",
    title: "废土六大调酒原料药理志",
    summary: "本店吧台冰柜仅有的六种真实废土原料及其烈度、安抚与净辐功效。",
    detail:
      "①【蒸馏辐射水】多重活性炭过滤清底，微幅净辐；②【变异土豆原浆】裂谷耐旱块茎发酵，辛辣饱腹、催醉极快（烈度+3）；③【铁锈烘麦芽】铁板焙烤变异大麦，焦香醇厚（烈度+2/安抚+2）；④【幽光菌菇露】二层冷库阴暗处采摘的蓝绿荧光菌萃，强力吸附体内游离辐射（净辐+4）；⑤【荒原安神草】废墟岩缝野生草本，专克狂躁与创伤失眠（安抚+4）；⑥【核冬冰薄荷】三层极寒核心凝结的冰晶薄荷叶，兼顾神经回路降温与深度净辐。",
    detectiveHint:
      "想套出潜伏暗探的口供破绽，优先连下两份「变异土豆原浆」加「多倒半杯」拉满烈度催醉；面对火药味极重的暴徒，则务必加入「荒原安神草」降张力。",
    unlockHint: "初始收录于吧台调酒手册",
    unlockedByDefault: true,
    keywords: [
      "原料",
      "配料",
      "辐射水",
      "土豆",
      "麦芽",
      "菌菇",
      "幽光",
      "安神草",
      "冰薄荷",
      "调酒",
      "配方",
    ],
  },
  {
    id: "lore_five_cocktails",
    code: "ECO-03",
    category: "DRINKS_ECONOMY",
    title: "零号街区五款招牌特调酒谱",
    summary: "从硬汉最爱的《铁锈烧刀子》到合成人救命饮《荧光净辐冷萃》的完整酒单。",
    detail:
      "·《铁锈烧刀子》(14盖)：双份变异土豆原浆+铁锈烘麦芽，一口烧穿喉咙，佣兵与硬汉首选；\n·《废墟暖胃甜麦饮》(11盖)：辐射水+土豆原浆+烘麦芽，饥寒拾荒客的暖身救命汤；\n·《荧光净辐冷萃》(18盖)：辐射水+幽光菌菇露+核冬冰薄荷，清洗辐射尘并为精密神经回路降温；\n·《商队金算盘特调》(17盖)：烘麦芽+幽光菌菇露+安神草，微甜奇诡的老江湖私房酒；\n·《荒原安魂曲》(16盖)：辐射水+安神草+冰薄荷，平息火并戾气与战后梦魇的良方。",
    detectiveHint:
      "切记：向讨厌「兑水寡淡」的老江湖偷偷兑辐射水省料，会被一眼尝出并导致危险张力飙升！",
    unlockHint: "初始收录于吧台调酒手册",
    unlockedByDefault: true,
    keywords: [
      "烧刀子",
      "甜麦饮",
      "暖胃",
      "冷萃",
      "净辐",
      "金算盘",
      "安魂曲",
      "招牌",
      "酒单",
      "喝什么",
      "推荐",
    ],
  },
  {
    id: "lore_wasteland_weather",
    code: "HAZ-01",
    category: "CREATURES_HAZARDS",
    title: "核冬寒潮、酸雾与磁暴雷云",
    summary: "灰烬裂谷变幻莫测的七日极端气候，直接左右来客的身体诉求。",
    detail:
      "由于高层大气尘埃云常年不散，零号街区交替经历铁锈微尘风、带旧电池酸涩味的轻度辐射酸雾、干冷如刀的核冬灰烬寒潮，以及令收音机与老旧义体滋滋作响的磁暴雷云。酸雾天进店的客人急需幽光菌菇净辐，寒潮夜推门的人只盼一口滚烫厚实的麦芽原浆。",
    detectiveHint:
      "结合门外当日天气与客人进门时的寒暄选酒，更容易触发契合心意的信任加成。",
    unlockHint: "初始收录于门廊气象记录",
    unlockedByDefault: true,
    keywords: [
      "天气",
      "核冬",
      "寒潮",
      "酸雾",
      "辐射",
      "磁暴",
      "沙暴",
      "风雪",
      "灰烬",
    ],
  },
  {
    id: "lore_ruin_beasts",
    code: "HAZ-02",
    category: "CREATURES_HAZARDS",
    title: "废墟异兽志：灰烬巨鼠与重甲巨钳兽",
    summary: "黑夜搜刮路上的致命天敌，首领巨钳兽唯有找准甲壳缝隙方能重创。",
    detail:
      "东区废墟入夜后危机四伏：成群的「灰烬巨鼠」会咬穿拾荒背包偷走食材；战前遗留的「失控防暴安保机」仍按损坏指令无差别扫射；而盘踞第三层极寒储藏室的「深层重甲巨钳兽」由辐射变异甲壳水生兽演化而来，双钳足以剪断钢梁。不过老练佣兵与暗探知晓其腹部散热旧伤——若白昼拿到弱点情报或设下假坐标诱敌踩坑，可提前削去首领两成战力。",
    detectiveHint:
      "白昼与巴克等实战派打好交道或成功给暗探喂假坐标设局，会直接削弱当晚第 3 层首领巨钳兽 20% 初始生命！",
    unlockHint: "与客人聊及「巨钳兽」「异兽」或经历黑夜狩猎话题时收录",
    unlockedByDefault: false,
    keywords: [
      "巨钳兽",
      "灰烬巨鼠",
      "老鼠",
      "安保机",
      "机器人",
      "怪物",
      "异兽",
      "首领",
      "霸主",
      "弱点",
    ],
  },
  {
    id: "lore_rad_cybernetics",
    code: "HAZ-03",
    category: "CREATURES_HAZARDS",
    title: "荒原义体改装、辐射病与过热症",
    summary: "琥珀焊接义眼、神经接口与第三代合成人独有的生物芯片过热特征。",
    detail:
      "裂谷老军医常为伤残佣兵加装由战前光学瞄具改制的琥珀义眼或机械义肢，这类粗糙改装在磁暴天会隐隐酸痛。与之截然不同的是中央数据塔制造的第三代合成人：外表有温热皮肤与脉搏，但高负荷逃亡或受电磁干扰时，后颈神经回路会出现异常高频发热，唯有高纯度「核冬冰薄荷」调配的冷萃饮才能迅速平息过热震颤，且极度排斥劣质辛辣杂醇。",
    detectiveHint:
      "若某位客人异常执着于冰爽降温、对辛辣土豆烈酒极其排斥，往往与精密神经义体或合成人构造有关。",
    unlockHint: "探讨「义眼」「过热」「抗辐」或调配冰薄荷冷萃互动时收录",
    unlockedByDefault: false,
    keywords: [
      "义眼",
      "义体",
      "改装",
      "过热",
      "发烧",
      "辐射病",
      "抗辐宁",
      "军医",
      "降温",
      "芯片",
    ],
  },
  {
    id: "lore_patron_relations",
    code: "SEC-01",
    category: "FIGURES_SECRETS",
    title: "吧台四常客明暗关系谱",
    summary: "阿灰、巴克、K-7 与莫里在零号街区的真实交集与彼此不知道的底牌。",
    detail:
      "· 阿灰与莫里：阿灰常把夜里淘到的旧铜管卖给莫里驼队，嫌莫里算盘精却认他守信；\n· 阿灰与巴克：阿灰起初怵巴克一身血齿帮煞气，后来见巴克替流民挡过劫匪才改观；\n· 巴克与莫里：莫里雇过巴克押送高危货道，两人是认钱也认胆量的老主顾；\n· 关于 K-7 的认知边界：除非酒馆传开特殊流言，否则阿灰、巴克与外头散客都只当 K-7 是个寡言少语的战前仪器修理匠，绝不知晓其逃亡合成人真身！",
    detectiveHint:
      "认知边界已同步约束 AI：普通客人不会开启上帝视角道破他人的隐藏底细。",
    unlockHint: "在吧台与多位常客深入寒暄互相提起彼此时收录",
    unlockedByDefault: false,
    keywords: [
      "认识阿灰",
      "认识巴克",
      "认识莫里",
      "认识k-7",
      "四位常客",
      "其他熟客",
      "熟客关系",
      "常客关系",
      "老主顾关系",
      "平时熟吗",
      "互相认识",
    ],
  },
  {
    id: "lore_undercover_protocol",
    code: "SEC-02",
    category: "FIGURES_SECRETS",
    title: "防空洞暗探潜伏与酒保三向裁决录",
    summary: "通缉犯、数据塔耳目与血齿帮暗桩混入酒馆的试探规律与拆穿后果。",
    detail:
      "零号街区鱼龙混杂，每日排队的过路客乃至个别熟客中常混有身负秘密议程的潜伏者。清醒时他们会死守表面口供；唯有靠高烈度调酒将其催醉至失言线以上，或针对其职业漏洞犀利盘问，才能逼出与哔哔小子通缉电报吻合的破绽。识破后酒保握有三条生杀路：当面拍出电报拆穿领赏（招来今夜买凶伏击）、收封口费包庇结盟（换其今夜同行助战），或看破不说破喂假坐标设局捡漏。",
    detectiveHint:
      "先看左下角哔哔小子「电报」记住当日通缉特征，再点开客人牛皮纸卷宗核对「表面口供」，侦探博弈事半功倍。",
    unlockHint: "首次在吧台识破任意客人伪装破绽或盘问底细时收录",
    unlockedByDefault: false,
    keywords: [
      "卧底",
      "暗探",
      "伪装",
      "破绽",
      "口供",
      "失言",
      "封口费",
      "包庇",
      "假坐标",
      "买凶",
    ],
  },
  {
    id: "lore_great_flash",
    code: "SEC-03",
    category: "FIGURES_SECRETS",
    title: "「大静默」核火纪元与荒原灯塔之约",
    summary: "87 年前两小时核火终结旧世界，而零号街区这盏钨丝灯仍在等待第七夜黎明。",
    detail:
      "老辈人把 87 年前那场毁灭旧文明的全球核交火称作「大静默」——短短两小时后，所有城市电台同时归于死寂，只剩盖革计数器的脆响。前任老掌柜临终前把 07 号防空洞钥匙和那把磨亮的黄铜雪克壶交给你时只留下一句话：「只要核冬风雪还没停，就别让吧台这盏钨丝灯灭了——总得给荒原上无处可去的人留个能卸下防备喝口热酒的地方。」",
    detectiveHint:
      "撑过七个昼夜循环并凝聚常客信任、守住酒馆安全度，将解锁「荒原灯塔」等不同终局铭刻。",
    unlockHint: "聊及「大静默」「核战」「以前的世界」或推进主线天数后收录",
    unlockedByDefault: false,
    keywords: [
      "大静默",
      "核战",
      "旧世界",
      "以前",
      "历史",
      "钨丝灯",
      "灯塔",
      "老掌柜",
      "七天",
    ],
  },
] as const;

export const DEFAULT_UNLOCKED_LORE_IDS: string[] = WASTELAND_LORE_DB.filter(
  (e) => e.unlockedByDefault
).map((e) => e.id);

/**
 * 为指定 NPC 生成严格的「角色认知边界（Anti-God-Mode Cognitive Boundary）」，防止角色说出自己不可能知道的上帝视角机密
 */
export function buildNpcCognitiveBoundary(npc: {
  id: string;
  name: string;
  title: string;
  faction?: string;
}): string {
  if (npc.id === "k7_synth") {
    return "【角色认知边界】你本人就是从「中央数据塔」逃亡的第三代仿生合成人 K-7，深知猎犬追缉队的危险，但在信任度未高到生死之交前不会轻易向陌生人嚷嚷芯片秘密；你认识常坐吧台的阿灰、巴克和行商莫里，但只了解他们明面上的身份。";
  }
  if (npc.id === "ash_scavenger") {
    return "【角色认知边界】你是零号街区土生土长的拾荒女孩阿灰，极熟东区废墟一层二层地形与粉笔暗号，认识莫里和巴克；注意：你完全不知道 K-7 是合成人（只当他是个面色苍白、懂修旧电器的怪技师），也不知道其他过路暗探的真实底细。";
  }
  if (npc.id === "buck_raider") {
    return "【角色认知边界】你是叛出「血齿掠夺帮」的独行硬汉佣兵巴克，熟知匪帮黑话、东区高架桥伏击点与巨钳兽甲壳弱点；注意：你不知道 K-7 是合成人，说话粗犷直接，只聊自己亲历过的刀口舔血见闻。";
  }
  if (npc.id === "mori_merchant") {
    return "【角色认知边界】你是自由驼队商会老掌柜莫里，精通瓶盖汇率、各聚落商道行情与流言风向；注意：你虽消息灵通，但对没有实锤的机密（如 K-7 真实身份）最多只听过模糊传闻，绝不跨界用全知口吻说话。";
  }
  return `【角色认知边界】你是荒原过路客「${npc.name}」（所属：${
    npc.faction || "荒原散客"
  } · ${
    npc.title
  }）。你只知道荒原公共常识（零号街区、瓶盖物价、本店六种原料酒水、核冬酸雾）以及与你自身行当/伪装身份相关的见闻，严禁未卜先知老板昨夜的私密战果或其他客人的隐藏身份！`;
}

/**
 * 1.A 动态按需词条召回引擎：根据当前客人身份、玩家提问词、端上酒品、当日电报与流言，精准召回 Top-K 最相关世界观词条注入 Prompt
 */
export function retrieveContextualLoreBlock(params: {
  npc: { id: string; name: string; title: string; faction?: string };
  playerMessage?: string;
  recentDialogueText?: string;
  servedDrinkName?: string;
  weatherDesc?: string;
  rumorTitles?: string[];
  topK?: number;
}): { promptBlock: string; matchedIds: string[] } {
  const {
    npc,
    playerMessage = "",
    recentDialogueText = "",
    servedDrinkName = "",
    weatherDesc = "",
    rumorTitles = [],
    topK = 5,
  } = params;

  const queryCorpus = [
    npc.name,
    npc.title,
    npc.faction || "",
    playerMessage,
    recentDialogueText,
    servedDrinkName,
    weatherDesc,
    ...rumorTitles,
  ]
    .join(" ")
    .toLowerCase();

  const scored = WASTELAND_LORE_DB.map((entry) => {
    let score = 0;
    for (const kw of entry.keywords) {
      const lowerKw = kw.toLowerCase();
      if (playerMessage && playerMessage.toLowerCase().includes(lowerKw)) {
        // 玩家当前这句主动追问命中关键词权重最高，确保对答如流绝不跑偏
        score += 6;
      } else if (servedDrinkName && servedDrinkName.toLowerCase().includes(lowerKw)) {
        score += 4;
      } else if (queryCorpus.includes(lowerKw)) {
        score += 2;
      }
    }
    if (
      npc.faction &&
      entry.relatedFactions?.some((f) => npc.faction?.includes(f) || f.includes(npc.faction || ""))
    ) {
      score += 5;
    }
    if (npc.id === "k7_synth" && (entry.id === "lore_data_tower" || entry.id === "lore_rad_cybernetics")) {
      score += 5;
    }
    if (npc.id === "buck_raider" && (entry.id === "lore_bloodtooth_gang" || entry.id === "lore_ruin_beasts")) {
      score += 5;
    }
    if (npc.id === "ash_scavenger" && (entry.id === "lore_scavenger_net" || entry.id === "lore_ruins_layers")) {
      score += 5;
    }
    if (npc.id === "mori_merchant" && (entry.id === "lore_caravan_guild" || entry.id === "lore_bottle_caps")) {
      score += 5;
    }
    return { entry, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const selected = scored
    .filter((item, idx) => item.score > 0 || idx < 2)
    .slice(0, topK)
    .map((item) => item.entry);

  const lines = selected.map((item) => {
    // 若非 K-7 本人召回了合成人词条，隐去 K-7 代号以防其他角色开天眼泄密
    const safeDetail =
      item.id === "lore_data_tower" && npc.id !== "k7_synth"
        ? item.detail.replace("（如代号 K-7）", "")
        : item.detail;
    return `- 【${item.code} ${item.title}】${safeDetail}`;
  });

  const promptBlock = [
    CORE_WORLD_CANON_PROMPT,
    buildNpcCognitiveBoundary(npc),
    `【本轮对话动态召回的世界观词条（请自然融入谈吐与细节，严禁编造相悖设定）】\n${lines.join(
      "\n"
    )}`,
  ].join("\n\n");

  return {
    promptBlock,
    matchedIds: selected.map((e) => e.id),
  };
}

/**
 * 2.B 扫描玩家提问与 NPC 最新回应文本，自动解锁聊天中涉及的未收录《废土档案》词条
 */
export function scanTextForLoreUnlocks(
  existingUnlockedIds: string[],
  textsToScan: string[]
): { nextUnlockedIds: string[]; newlyUnlockedEntries: WastelandLoreEntry[] } {
  const unlockedSet = new Set<string>(
    existingUnlockedIds.length > 0
      ? existingUnlockedIds
      : DEFAULT_UNLOCKED_LORE_IDS
  );
  const combined = textsToScan.filter(Boolean).join(" ").toLowerCase();
  if (!combined) {
    return {
      nextUnlockedIds: Array.from(unlockedSet),
      newlyUnlockedEntries: [],
    };
  }

  const newlyUnlocked: WastelandLoreEntry[] = [];
  for (const entry of WASTELAND_LORE_DB) {
    if (unlockedSet.has(entry.id)) continue;
    const hit = entry.keywords.some((kw) =>
      combined.includes(kw.toLowerCase())
    );
    if (hit) {
      unlockedSet.add(entry.id);
      newlyUnlocked.push(entry);
    }
  }

  return {
    nextUnlockedIds: Array.from(unlockedSet),
    newlyUnlockedEntries: newlyUnlocked,
  };
}

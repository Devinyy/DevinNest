// src/data/cocktails.ts
// ─────────────────────────────────────────────
// 🍹 调酒配方数据
// 新增配方：在对应 family 的 recipes 数组末尾加一个对象即可
// 新增家族：在 COCKTAIL_FAMILIES 数组末尾加一个 family 对象
// ─────────────────────────────────────────────

export type Ingredient = {
  name: string
  amount: string
}

export type Step = string

export type RecipeVariant = {
  label: string          // Tab 标签名，如「我的版本」
  ingredients: Ingredient[]
  steps: Step[]
  note?: string          // 备注，可选
}

export type Recipe = {
  id: string             // 唯一 id，用于 DOM，如 "mojito"
  name: string           // 中文名
  nameEn?: string        // 英文名，可选
  sub: string            // 副标题，如「古巴 · 1940s · 白朗姆基酒」
  image?: string         // 图片路径，如 "/images/cocktail/mojito.jpg"，无图留空
  tagColor: 'green' | 'pink' | 'amber'
  tags: string[]         // 标签列表
  // 单版本配方直接用 ingredients + steps + note
  // 多版本配方用 variants（会渲染 Tab）
  ingredients?: Ingredient[]
  steps?: Step[]
  note?: string
  variants?: RecipeVariant[]
}

export type CocktailFamily = {
  id: string             // anchor id，如 "julep"
  name: string           // 显示名，如「Julep · 朱丽普」
  tag: string            // 副标签，如「烈酒＋薄荷＋碎冰」
  // layout: card = 左图右内容大卡片；grid = 小卡片网格
  layout: 'card' | 'grid'
  intro?: string         // grid 布局时的说明文字，可选
  recipes: Recipe[]
}

// ─────────────────────────────────────────────
// 📦 数据主体
// ─────────────────────────────────────────────

export const COCKTAIL_FAMILIES: CocktailFamily[] = [
  // ══════════════════════════════════════
  // Julep 朱丽普类
  // ══════════════════════════════════════
  {
    id: 'julep',
    name: 'Julep · 朱丽普',
    tag: '烈酒＋薄荷＋碎冰',
    layout: 'card',
    recipes: [
      {
        id: 'mojito',
        name: '莫吉托',
        nameEn: 'Mojito',
        sub: '古巴 · 1940s · 白朗姆基酒',
        image: '/images/cocktail/mojito.png',
        tagColor: 'green',
        tags: ['Julep', '长饮'],
        variants: [
          {
            label: '我的版本',
            ingredients: [
              { name: '白朗姆酒', amount: '50ml' },
              { name: '鲜榨青柠汁', amount: '30ml' },
              { name: '新鲜薄荷叶', amount: '8～10 片' },
              { name: '雪碧', amount: '约 150ml' },
              { name: '冰块', amount: '适量' },
            ],
            steps: [
              '薄荷叶放杯底，轻拍释放香气（不要捣碎）',
              '加入青柠汁，填满冰块',
              '倒入白朗姆酒',
              '最后倒入雪碧，轻搅一下',
              '薄荷枝＋青柠角装饰，插吸管',
            ],
            note: '雪碧代替「苏打水＋白砂糖」，更甜气泡更足。薄荷过度捣碎会出苦味。即调即喝，跑气后风味全毁。',
          },
          {
            label: 'IBA 标准',
            ingredients: [
              { name: '古巴白朗姆酒', amount: '40ml' },
              { name: '鲜榨青柠汁', amount: '30ml' },
              { name: '新鲜薄荷叶', amount: '6 片' },
              { name: '白砂糖', amount: '2 茶匙' },
              { name: '苏打水', amount: '加满' },
              { name: '碎冰', amount: '适量' },
            ],
            steps: [
              '杯底放薄荷、白砂糖、青柠汁，搅至糖融化',
              '填入碎冰至八分满',
              '倒入白朗姆酒',
              '加满苏打水，轻柔搅拌',
              '薄荷枝＋青柠片装饰',
            ],
            note: 'IBA 指定古巴白朗姆。砂糖可换糖浆更易溶解。口感比雪碧版更干爽清洌，酸甜平衡度更高。',
          },
          {
            label: '世界杯观赛版',
            ingredients: [
              { name: '白朗姆酒', amount: '45ml' },
              { name: '青柠汁', amount: '20ml' },
              { name: '薄荷叶', amount: '6 整枝，约 8～10 片大叶' },
              { name: '单糖浆', amount: '20ml' },
              { name: '苏打水', amount: '补满' },
              { name: '碎冰', amount: '适量' },
            ],
            steps: [
              '柯林杯中放薄荷叶、单糖浆和鲜青柠汁',
              '用捣棒贴杯壁轻轻按压薄荷叶 5～8 下，不要捣烂',
              '加满碎冰并压实，补到离杯口约 1cm',
              '倒入白朗姆酒',
              '苏打水补满，轻轻提拉搅拌 1～2 圈',
              '补少量碎冰做冰丘，杯口插薄荷嫩枝和青柠角',
            ],
            note: '来自 Yuk 的世界杯观赛特调。保留薄荷茎秆会更有香气；动作要轻，避免薄荷出苦味和苏打水跑气。',
          },
        ],
      },
      // ── 在这里继续添加 Julep 类新配方 ──
    ],
  },

  // ══════════════════════════════════════
  // Highball 高球类
  // ══════════════════════════════════════
  {
    id: 'highball',
    name: 'Highball · 高球',
    tag: '烈酒＋软饮料',
    layout: 'card',
    recipes: [
      {
        id: 'bafenyuyu',
        name: '芭粉物语',
        sub: '伏特加 · 芭乐 · 粉色系',
        image: '/images/cocktail/bfwy.png',
        tagColor: 'pink',
        tags: ['Highball', '长饮', '粉色'],
        ingredients: [
          { name: '伏特加', amount: '50ml' },
          { name: '芭乐桃桃（果汁）', amount: '100ml' },
          { name: '红心芭乐气泡水', amount: '100ml' },
          { name: '冰块', amount: '适量' },
        ],
        steps: [
          '杯中加满冰块，倒入伏特加',
          '倒入芭乐桃桃果汁',
          '沿杯壁缓缓倒入红心芭乐气泡水',
          '轻搅，粉色吸管＋薄荷叶装饰',
        ],
        note: '红心芭乐天然粉色，无需额外色素。气泡水最后倒保留气泡感。可加少量柠檬汁提升层次。即调即喝。',
      },
      {
        id: 'tropical-mirage',
        name: '热带迷踪',
        nameEn: 'Tropical Mirage',
        sub: '白朗姆 · 百香果 · 椰子水 · 热带风格',
        image: '',  // '/images/cocktail/tropical-mirage.jpg'
        tagColor: 'amber',
        tags: ['Highball', '长饮', '百香果'],
        variants: [
          {
            label: '酒精版',
            ingredients: [
              { name: '白朗姆酒', amount: '45ml' },
              { name: '新鲜百香果', amount: '2 个（果肉挖出）' },
              { name: '椰子水', amount: '150ml' },
              { name: '青柠汁', amount: '15ml' },
              { name: '蜂蜜', amount: '10ml' },
              { name: '冰块', amount: '适量' },
            ],
            steps: [
              '蜂蜜＋青柠汁在杯底先搅匀',
              '加满冰块',
              '倒入白朗姆酒',
              '倒入椰子水，轻搅',
              '将百香果肉直接浇在顶部，不要搅散，保留颗粒感和视觉层次',
            ],
            note: '百香果肉浇顶是灵魂，喝之前再搅散。椰子水可换成气泡水，口感更清爽。即调即喝。',
          },
        ],
      },
      {
        id: 'rainbow',
        name: '彩虹',
        nameEn: 'Rainbow',
        sub: '蓝橙力娇酒 · 橙汁 · 葡萄汽水 · Float 分层',
        image: '/images/cocktail/rainbow.png',
        tagColor: 'amber',
        tags: ['Highball', 'Float', '分层', '无基酒'],
        ingredients: [
          { name: '蓝橙力娇酒（Blue Curaçao）', amount: '30ml' },
          { name: '橙汁', amount: '80ml' },
          { name: '元气森林葡萄汽水', amount: '100ml' },
          { name: '大冰块', amount: '1～2 块' },
          { name: '柠檬角', amount: '1 片（装饰）' },
        ],
        steps: [
          '杯中放入大冰块',
          '沿杯壁倒入蓝橙力娇酒，沉入杯底',
          '将橙汁沿吧匙缓缓注入，形成中间层（不要直接倒，会破坏分层）',
          '最后将元气森林葡萄汽水沿吧匙缓缓漂浮在顶部',
          '柠檬角装饰杯口，不要搅拌，保留分层效果',
        ],
        note: '分层关键：密度从大到小依次是蓝橙→橙汁→葡萄汽水，每层沿吧匙缓慢注入。喝之前用吸管从底部搅散，颜色会变成迷幻渐变色。即调即喝，气泡消散后分层会模糊。',
      },
      {
        id: 'tequila-sunset',
        name: '龙舌兰日落',
        nameEn: 'Tequila Sunset',
        sub: '龙舌兰 · 橙汁 · 葡萄汽水渐变',
        image: '',
        tagColor: 'amber',
        tags: ['Highball', '渐变', '世界杯观赛'],
        ingredients: [
          { name: '龙舌兰', amount: '45ml' },
          { name: '橙汁', amount: '120ml' },
          { name: '柠檬汁', amount: '10ml' },
          { name: '原味糖浆', amount: '5～10ml' },
          { name: '葡萄汽水', amount: '20ml' },
        ],
        steps: [
          '柯林杯加满冰块，旋转润杯，倒掉融化冰水',
          '倒入龙舌兰、柠檬汁、糖浆和橙汁，轻轻搅匀',
          '贴杯壁缓慢倒入葡萄汽水，让汽水浮在上层形成紫红渐变',
          '可插橙片装饰；不要摇匀，喝的时候再搅',
        ],
        note: '葡萄汽水替代红石榴糖浆做顶部颜色。橙汁甜度不同，糖浆从 5ml 起试。',
      },
      {
        id: 'gin-tonic',
        name: '金汤力',
        nameEn: 'Gin Tonic',
        sub: '金酒 · 汤力水 · 青柠',
        image: '',
        tagColor: 'green',
        tags: ['Highball', '入门', '气泡'],
        ingredients: [
          { name: '金酒', amount: '45ml' },
          { name: '汤力水', amount: '补满杯量' },
          { name: '青柠', amount: '1/4 个' },
          { name: '冰块', amount: '适量' },
        ],
        steps: [
          '柯林杯加满冰块并润杯',
          '倒入金酒',
          '挤青柠角出汁，青柠角丢进杯里',
          '沿杯壁缓慢倒入冰镇汤力水至八分满',
          '吧勺只上下提拉 1～2 下搅匀，避免破坏气泡',
        ],
        note: '入门复刻优先级最高的一杯。汤力水一定要冰，搅拌越克制越清爽。',
      },
      {
        id: 'whisky-highball',
        name: '嗨棒',
        nameEn: 'Whisky Highball',
        sub: '威士忌 · 苏打水 · 柠檬',
        image: '',
        tagColor: 'amber',
        tags: ['Highball', '入门', '气泡'],
        ingredients: [
          { name: '威士忌', amount: '45ml' },
          { name: '苏打水', amount: '补满杯量' },
          { name: '柠檬角', amount: '1 个，可选' },
          { name: '冰块', amount: '适量' },
        ],
        steps: [
          '柯林杯加满冰块并润杯',
          '倒入威士忌',
          '挤半个柠檬角的汁进杯，柠檬角丢入杯中',
          '沿杯壁缓慢倒入冰镇苏打水至八分满',
          '吧勺轻轻提拉 1～2 下搅匀，禁止转圈猛搅',
          '杯口插柠檬片，配长吸管',
        ],
        note: '苏打水贴杯壁慢倒，尽量保留气泡。波本或调和威士忌都适合做日常版本。',
      },
      {
        id: 'miami-beach',
        name: '迈阿密海滩',
        nameEn: 'Miami Beach',
        sub: '白朗姆 · 养乐多 · 乌龙茶或葡萄汽水',
        image: '',
        tagColor: 'pink',
        tags: ['Highball', '乳酸', '世界杯观赛'],
        ingredients: [
          { name: '白朗姆', amount: '30ml' },
          { name: '养乐多', amount: '1 瓶，约 60ml' },
          { name: '无糖乌龙茶或葡萄汽水', amount: '补满' },
          { name: '冰块', amount: '适量' },
        ],
        steps: [
          '柯林杯加满冰块并润杯',
          '倒入白朗姆和整瓶养乐多',
          '用吧勺插到底提拉搅匀，打散养乐多避免结块',
          '贴杯壁缓慢注入冰镇乌龙茶或葡萄汽水',
          '轻微提拉 1 次融合即可，不要大力转圈搅拌',
          '可用柠檬片或薄荷叶点缀，配长吸管',
        ],
        note: '乌龙茶版更清爽，葡萄汽水版更甜、更有观赛饮料感。',
      },
      {
        id: 'long-island-iced-tea',
        name: '长岛冰茶',
        nameEn: 'Long Island Iced Tea',
        sub: '五种烈酒 · 柠檬 · 可乐调色',
        image: '',
        tagColor: 'amber',
        tags: ['Highball', '烈度高', '经典'],
        ingredients: [
          { name: '伏特加', amount: '15ml' },
          { name: '银龙舌兰', amount: '15ml' },
          { name: '白朗姆', amount: '15ml' },
          { name: '金酒', amount: '15ml' },
          { name: '君度', amount: '15ml' },
          { name: '柠檬汁', amount: '25ml' },
          { name: '单糖浆', amount: '30ml' },
          { name: '可乐', amount: '少量，调色提气' },
        ],
        steps: [
          '柯林杯加满冰块，润杯后倒掉融化冰水',
          '依次倒入五款烈酒、柠檬汁和单糖浆',
          '吧勺轻轻搅拌均匀',
          '慢慢倒入可乐至八分满，避免气泡大量流失',
          '轻微提拉搅匀 1 次，装饰柠檬片并配长吸管',
        ],
        note: '酒精基底多，可乐主要用于颜色和气泡，不是大杯兑饮。烈度高，慢慢喝。',
      },
      // ── 在这里继续添加 Highball 类新配方 ──
    ],
  },

  // ══════════════════════════════════════
  // Fizz / Collins 气泡酸甜长饮
  // ══════════════════════════════════════
  {
    id: 'fizz-collins',
    name: 'Fizz / Collins · 气泡酸甜长饮',
    tag: '烈酒＋柑橘＋糖＋气泡',
    layout: 'card',
    recipes: [
      {
        id: 'gin-fizz',
        name: '金菲士',
        nameEn: 'Gin Fizz',
        sub: '金酒 · 柠檬 · 糖浆 · 气泡水',
        image: '',
        tagColor: 'green',
        tags: ['Fizz', '摇和', '气泡'],
        ingredients: [
          { name: '金酒', amount: '45ml' },
          { name: '柠檬汁', amount: '30ml' },
          { name: '原味糖浆', amount: '15ml' },
          { name: '气泡水', amount: '补满杯量' },
          { name: '冰块', amount: '适量' },
        ],
        steps: [
          '柯林杯加满冰块并润杯',
          '雪克壶放冰，加入金酒、柠檬汁、糖浆',
          '摇 10～15 秒充分冰镇混合',
          '滤入杯中',
          '贴杯壁注入气泡水至八九分满，轻轻搅一圈',
          '柠檬圆片挂杯装饰',
        ],
        note: '先摇酒和酸甜底，再加气泡水。不要把气泡水放进雪克壶。',
      },
    ],
  },

  // ══════════════════════════════════════
  // Sour / Sidecar 酸甜摇和短饮
  // ══════════════════════════════════════
  {
    id: 'sour',
    name: 'Sour · 酸甜摇和短饮',
    tag: '烈酒＋柑橘＋甜味',
    layout: 'card',
    recipes: [
      {
        id: 'cosmopolitan',
        name: '大都会',
        nameEn: 'Cosmopolitan',
        sub: '伏特加 · 君度 · 青柠 · 蔓越莓',
        image: '',
        tagColor: 'pink',
        tags: ['Sour', '摇和', '粉色'],
        ingredients: [
          { name: '伏特加', amount: '45ml' },
          { name: '君度', amount: '15ml' },
          { name: '青柠汁', amount: '15ml' },
          { name: '蔓越莓汁', amount: '30ml，可用葡萄汽水替代' },
        ],
        steps: [
          '鸡尾杯提前冰镇',
          '雪克壶倒入全部原料和大量冰块',
          '用力摇 10～15 秒，直到壶身起白霜',
          '双重滤冰倒入冷杯',
          '柠檬长条挤精油，擦杯口；果皮用于装饰，不放进酒里',
        ],
        note: '葡萄汽水是作者的家用替代版本；想靠近经典风味时用蔓越莓汁。',
      },
      {
        id: 'gimlet',
        name: '吉姆雷特',
        nameEn: 'Gimlet',
        sub: '金酒 · 青柠 · 单糖浆',
        image: '',
        tagColor: 'green',
        tags: ['Sour', '摇和', '经典'],
        ingredients: [
          { name: '金酒', amount: '50ml' },
          { name: '青柠汁', amount: '25ml' },
          { name: '单糖浆', amount: '15ml' },
        ],
        steps: [
          '鸡尾杯提前冰镇',
          '雪克壶倒入全部原料，加满冰块',
          '大力摇和 12～15 秒至壶身结厚白霜',
          '双重滤冰倒入预冷空杯',
          '柠檬长条挤精油擦杯口，果皮当装饰，不泡进酒里',
        ],
        note: '结构很干净，青柠新鲜度会直接决定成品上限。',
      },
      {
        id: 'xyz',
        name: 'XYZ',
        sub: '白朗姆 · 君度 · 柠檬',
        image: '',
        tagColor: 'amber',
        tags: ['Sour', '摇和', '经典'],
        ingredients: [
          { name: '白朗姆', amount: '45ml' },
          { name: '君度', amount: '22.5ml' },
          { name: '柠檬汁', amount: '22.5ml' },
        ],
        steps: [
          '鸡尾杯提前冰镇',
          '雪克壶倒入全部原料，加满冰块',
          '大力摇到壶身结厚白霜，使酒体充分降温乳化',
          '双重滤冰倒入冷杯',
          '柠檬皮挤精油擦杯口，果皮不放入酒内',
        ],
        note: '三段式酸甜短饮，比例好记。摇和要足，入口会更圆润。',
      },
      {
        id: 'white-lady',
        name: '白色佳人',
        nameEn: 'White Lady',
        sub: '金酒 · 君度 · 柠檬',
        image: '',
        tagColor: 'green',
        tags: ['Sour', '摇和', '经典'],
        ingredients: [
          { name: '金酒', amount: '40ml' },
          { name: '君度', amount: '30ml' },
          { name: '柠檬汁', amount: '20ml' },
        ],
        steps: [
          '鸡尾杯提前冰镇',
          '雪克壶倒入金酒、君度、柠檬汁，加满冰块',
          '大力摇和约 10～15 秒至壶身结白霜',
          '双重滤冰倒入杯子',
          '柠檬皮挤精油擦杯口，果皮作为装饰但不要泡进酒里',
        ],
        note: '标准酸甜型摇和短饮。君度比例较高，柑橘香会更明显。',
      },
      {
        id: 'whisky-sour',
        name: '威士忌酸',
        nameEn: 'Whisky Sour',
        sub: '威士忌 · 柠檬 · 糖浆 · 苦精',
        image: '',
        tagColor: 'amber',
        tags: ['Sour', '摇和', '经典'],
        ingredients: [
          { name: '威士忌', amount: '45ml' },
          { name: '柠檬汁', amount: '30ml' },
          { name: '单糖浆', amount: '15ml' },
          { name: '苦精', amount: '1 滴，可选' },
        ],
        steps: [
          '古典杯加满冰块并润杯',
          '雪克壶倒入威士忌、柠檬汁、单糖浆，加满冰块',
          '大力摇 12～15 秒至壶身起白霜',
          '双重滤冰倒入冷杯',
          '杯面滴 1 滴苦精，可用柠檬皮挤精油装饰',
        ],
        note: '苦精不是必需，但能让收尾更立体。想要泡沫版可另加蛋清或替代起泡剂。',
      },
    ],
  },

  // ══════════════════════════════════════
  // Colada 椰香热带
  // ══════════════════════════════════════
  {
    id: 'colada',
    name: 'Colada · 椰香热带',
    tag: '朗姆＋椰子＋菠萝',
    layout: 'card',
    recipes: [
      {
        id: 'pina-colada',
        name: '椰林飘香',
        nameEn: 'Pina Colada',
        sub: '白朗姆 · 椰子 · 菠萝',
        image: '',
        tagColor: 'amber',
        tags: ['Colada', '热带', '冰沙'],
        ingredients: [
          { name: '白朗姆酒', amount: '30ml' },
          { name: '椰子奶油', amount: '30ml，或 Kara 椰浆 35ml＋单糖浆 10ml' },
          { name: '菠萝汁', amount: '90ml' },
          { name: '青柠汁', amount: '5ml，可选' },
          { name: '冰块', amount: '适量' },
        ],
        steps: [
          '有搅拌机：所有液体原料倒入搅拌机，加满冰块',
          '高速搅打至顺滑细腻冰沙、无冰碴，直接倒入飓风杯',
          '无搅拌机：柯林杯加满冰块并润杯',
          '雪克壶加冰，倒入全部材料，大力摇 15 秒至壶身结白霜',
          '双重滤冰倒入杯中，搅匀即可',
          '可插菠萝角和樱桃点缀，搭配粗吸管饮用',
        ],
        note: 'Coco Lopez 更接近经典。用椰浆替代时加一点糖浆，青柠汁能解腻。',
      },
    ],
  },

  // ══════════════════════════════════════
  // Shot / Flaming 高烈度
  // ══════════════════════════════════════
  {
    id: 'shot',
    name: 'Shot / Flaming · 高烈度',
    tag: '小杯 · 点火 · 慎做',
    layout: 'card',
    recipes: [
      {
        id: 'no-going-home-tonight',
        name: '今夜不回家',
        sub: '多烈酒混合 · 可点燃 · 高风险',
        image: '',
        tagColor: 'pink',
        tags: ['Shot', '烈度高', '点火'],
        ingredients: [
          { name: '白朗姆', amount: '15ml' },
          { name: '银龙舌兰', amount: '15ml' },
          { name: '威士忌', amount: '15ml' },
          { name: '加利安奴利口酒', amount: '15ml，可用君度 10ml＋伦敦干金 5ml 替代' },
          { name: '伏特加', amount: '15ml，作者加料版本' },
          { name: '青柠汁', amount: '10ml，可选' },
        ],
        steps: [
          '鸡尾杯依次倒入全部酒，吧勺轻轻搅匀',
          '如需点火，用防风打火机凑近液面点燃，确认周围远离易燃物',
          '必须熄灭明火后再入口',
          '怕不好入口可加 10ml 青柠汁中和后再喝',
        ],
        note: '风险提示：这杯混合多种烈酒且涉及点火，不适合新手随意复刻；点火时远离易燃物、头发和衣物，未成年人禁止饮酒。',
      },
    ],
  },

  // ══════════════════════════════════════
  // 玻汾茶系（中式 Highball）
  // ══════════════════════════════════════
  {
    id: 'bolfen',
    name: '玻汾茶系 · 中式 Highball',
    tag: '黄盖玻汾为基酒',
    layout: 'grid',
    intro: '茶底建议冷泡（冷水浸泡冰箱 4～8 小时），口感更清甜无苦涩。玻汾与茶基础比例 1:3～1:4。',
    recipes: [
      {
        id: 'baiyuchunfeng',
        name: '白玉春风',
        sub: '白毫银针冷泡＋气泡水＋柠檬片，入门首选',
        image: '',  // '/images/cocktail/baiyuchunfeng.jpg'
        tagColor: 'amber',
        tags: ['即调即喝'],
        ingredients: [
          { name: '玻汾', amount: '50ml' },
          { name: '白毫银针冷泡茶', amount: '150ml' },
          { name: '气泡水', amount: '50ml' },
          { name: '柠檬片＋冰块', amount: '适量' },
        ],
        steps: [
          '杯中加满冰块',
          '倒入玻汾',
          '倒入白毫银针冷泡茶',
          '沿杯壁缓缓倒入气泡水',
          '柠檬片装饰，轻搅即可',
        ],
        note: '⏱ 即调即喝（含气泡）',
      },
      {
        id: 'longjingweixun',
        name: '龙井微醺',
        sub: '龙井豆香＋黄瓜片，清新解腻',
        image: '',
        tagColor: 'amber',
        tags: ['冷藏 6h 内'],
        ingredients: [
          { name: '玻汾', amount: '50ml' },
          { name: '龙井冷泡茶', amount: '200ml' },
          { name: '黄瓜片', amount: '3 片' },
          { name: '蜂蜜＋冰块', amount: '适量' },
        ],
        steps: [
          '杯中加满冰块',
          '加入少量蜂蜜，倒入玻汾',
          '倒入龙井冷泡茶，轻搅融合蜂蜜',
          '放入黄瓜片装饰',
        ],
        note: '⏱ 冷藏 6h 内',
      },
      {
        id: 'moliqi',
        name: '茉莉气泡',
        sub: '茉莉浓香＋气泡水，轻盈清爽',
        image: '',
        tagColor: 'amber',
        tags: ['即调即喝'],
        ingredients: [
          { name: '玻汾', amount: '50ml' },
          { name: '茉莉花茶冷泡', amount: '100ml' },
          { name: '气泡水', amount: '100ml' },
          { name: '蜂蜜 5ml＋冰块', amount: '适量' },
        ],
        steps: [
          '杯中加满冰块',
          '加入蜂蜜＋玻汾，轻搅',
          '倒入茉莉花茶冷泡',
          '最后沿杯壁倒入气泡水，保留气泡',
        ],
        note: '⏱ 即调即喝（含气泡）',
      },
      {
        id: 'mitaowulong',
        name: '蜜桃乌龙',
        sub: '乌龙花果香＋鲜桃片，颜值担当',
        image: '',
        tagColor: 'amber',
        tags: ['冷藏 8h 内'],
        ingredients: [
          { name: '玻汾', amount: '50ml' },
          { name: '乌龙茶冷泡', amount: '150ml' },
          { name: '新鲜桃子片', amount: '4～5 片' },
          { name: '蜂蜜 8ml＋冰块', amount: '适量' },
        ],
        steps: [
          '杯中加满冰块',
          '加入蜂蜜＋玻汾，轻搅',
          '倒入乌龙茶冷泡',
          '喝前放入桃子片（不提前泡入）',
        ],
        note: '⏱ 冷藏 8h 内',
      },
      {
        id: 'strawberry',
        name: '草莓白茶气泡',
        sub: '草莓切片＋白茶＋气泡水，颜色漂亮',
        image: '',
        tagColor: 'amber',
        tags: ['冷藏 4h 内'],
        ingredients: [
          { name: '玻汾', amount: '50ml' },
          { name: '白茶冷泡', amount: '100ml' },
          { name: '草莓（切片）', amount: '2 颗' },
          { name: '气泡水 80ml＋蜂蜜', amount: '适量' },
        ],
        steps: [
          '杯中加满冰块，放入草莓切片',
          '加少量蜂蜜＋玻汾，轻搅',
          '倒入白茶冷泡',
          '最后沿杯壁倒入气泡水，保留气泡',
        ],
        note: '⏱ 冷藏 4h 内',
      },
      {
        id: 'citrus',
        name: '柑橘绿茶',
        sub: '碧螺春＋柑橘片，最接近 Sour 风格',
        image: '',
        tagColor: 'amber',
        tags: ['冷藏 6h 内'],
        ingredients: [
          { name: '玻汾', amount: '50ml' },
          { name: '碧螺春冷泡茶', amount: '150ml' },
          { name: '橙子/柚子片', amount: '适量' },
          { name: '气泡水 50ml＋冰块', amount: '适量' },
        ],
        steps: [
          '杯中加满冰块，放入柑橘片',
          '倒入玻汾',
          '倒入碧螺春冷泡茶',
          '沿杯壁倒入气泡水，轻搅',
        ],
        note: '⏱ 冷藏 6h 内',
      },
      {
        id: 'lapsang',
        name: '正山小种烟熏调',
        sub: '松烟香与汾酒清香同维度叠加',
        image: '',
        tagColor: 'amber',
        tags: ['冷藏 12h 内'],
        ingredients: [
          { name: '玻汾', amount: '50ml' },
          { name: '正山小种冷泡茶', amount: '200ml' },
          { name: '冰块', amount: '适量' },
        ],
        steps: [
          '正山小种冷泡 6～8h 备用（茶水比 1:60）',
          '杯中加满冰块',
          '倒入玻汾，再倒入冷泡茶',
          '轻搅即可，无需装饰',
        ],
        note: '⏱ 冷藏 12h 内（全系最耐放）',
      },
      {
        id: 'longjingbofeng',
        name: '龙井玻汾',
        sub: '最纯粹的清雅搭配，只有茶与酒',
        image: '',
        tagColor: 'amber',
        tags: ['冷藏 6h 内'],
        ingredients: [
          { name: '玻汾', amount: '50ml' },
          { name: '龙井冷泡茶', amount: '200ml' },
          { name: '冰块', amount: '适量' },
        ],
        steps: [
          '龙井冷泡 4～5h 备用（茶水比 1:80）',
          '杯中加满冰块',
          '倒入玻汾，再倒入冷泡茶',
          '轻搅，不加气泡水',
        ],
        note: '⏱ 冷藏 6h 内',
      },
      // ── 在这里继续添加玻汾茶系新配方 ──
    ],
  },

  // ══════════════════════════════════════
  // Mocktail 无酒精特调
  // ══════════════════════════════════════
  {
    id: 'mocktail',
    name: 'Mocktail · 无酒精特调',
    tag: '无酒精 · 人人可喝',
    layout: 'card',
    recipes: [
      {
        id: 'virgin-mojito',
        name: '无酒精莫吉托',
        nameEn: 'Virgin Mojito',
        sub: '经典莫吉托去酒版 · 薄荷青柠气泡',
        image: '',
        tagColor: 'green',
        tags: ['Mocktail', '无酒精', 'Julep'],
        ingredients: [
          { name: '鲜榨青柠汁', amount: '40ml' },
          { name: '新鲜薄荷叶', amount: '10～12 片' },
          { name: '蜂蜜或糖浆', amount: '15ml' },
          { name: '苏打水或青柠气泡水', amount: '加满' },
          { name: '碎冰', amount: '适量' },
        ],
        steps: [
          '薄荷叶＋蜂蜜＋青柠汁放杯底，轻捣',
          '填入碎冰',
          '加满苏打水或青柠气泡水，轻搅',
          '薄荷枝装饰',
        ],
        note: '用椰子水代替苏打水可增清甜感。适合开车、孕期或不喝酒的场合。',
      },
      {
        id: 'virgin-tropical-mirage',
        name: '无酒精热带迷踪',
        nameEn: 'Virgin Tropical Mirage',
        sub: '百香果 · 椰子水 · 气泡 · 热带无酒精',
        image: '',
        tagColor: 'amber',
        tags: ['Mocktail', '无酒精', '百香果'],
        ingredients: [
          { name: '新鲜百香果', amount: '2 个（果肉挖出）' },
          { name: '椰子水', amount: '180ml' },
          { name: '青柠汁', amount: '20ml' },
          { name: '蜂蜜', amount: '15ml' },
          { name: '气泡水', amount: '50ml' },
          { name: '冰块', amount: '适量' },
        ],
        steps: [
          '蜂蜜＋青柠汁在杯底先搅匀',
          '加满冰块',
          '倒入椰子水',
          '沿杯壁缓缓倒入气泡水',
          '百香果肉浇顶，不要搅散',
        ],
        note: '蜂蜜可换成糖浆更易溶解。气泡水让口感更轻盈，适合夏天。即调即喝。',
      },
      {
        id: 'lychee-oolong-fizz',
        name: '荔香乌龙菲士',
        nameEn: 'Lychee Oolong Fizz',
        sub: '自制荔枝糖油 · 玫瑰乌龙 · CO₂气泡',
        image: '',
        tagColor: 'pink',
        tags: ['Mocktail', '无酒精', 'Fizz', '需预制'],
        ingredients: [
          { name: '荔枝糖油（见备注）', amount: '60ml' },
          { name: '鲜榨青柠汁', amount: '20ml' },
          { name: '三得利玫瑰乌龙', amount: '180ml' },
          { name: 'CO₂气泡弹', amount: '2 颗' },
        ],
        steps: [
          '提前制作荔枝糖油：荔枝果肉去核，加入等重砂糖，抽真空密封冷藏 24h，过滤备用',
          '杯中加满冰块',
          '倒入荔枝糖油＋青柠汁，轻搅',
          '倒入玫瑰乌龙茶',
          '注入 CO₂ 气泡弹，打入气泡',
        ],
        note: '荔枝糖油是灵魂，提前一天制作。CO₂气泡弹比苏打水气泡更细腻，在烘焙/调酒器材店可以买到。没有气泡弹可用苏打水代替，但口感略有差异。',
      },
      {
        id: 'oolong-colada',
        name: '乌龙椰林飘香',
        nameEn: 'Oolong Colada',
        sub: '椰林飘香无酒精改编 · 三得利玫瑰乌龙 · 椰浆泡沫',
        image: '',
        tagColor: 'green',
        tags: ['Mocktail', '无酒精', 'Colada', '需预制'],
        ingredients: [
          { name: '凤梨汁（鲜榨）', amount: '60ml' },
          { name: '糖浆', amount: '15ml' },
          { name: '鲜榨青柠汁', amount: '20ml' },
          { name: '盐溶液（见备注）', amount: '3 dash' },
          { name: '三得利玫瑰乌龙', amount: '45ml' },
          { name: '椰浆泡沫（见备注）', amount: '盖顶适量' },
        ],
        steps: [
          '提前制作盐溶液：纯净水中加入 20% 盐，搅拌至完全融化备用',
          '提前制作椰浆泡沫：200ml 椰浆冷藏 2h，加入 15ml 枫糖，打发后冷藏备用',
          '凤梨榨汁备用',
          '杯中加满冰块',
          '倒入凤梨汁＋糖浆＋青柠汁＋盐溶液，轻搅',
          '倒入玫瑰乌龙茶',
          '将椰浆泡沫用吧匙轻轻铺在顶部，不要搅散',
        ],
        note: '盐溶液只需 3 dash，用于提鲜而非咸味。椰浆泡沫需要打发机或奶泡机，冷藏后质地更稳定。整体风格是椰林飘香（Piña Colada）的无酒精改编，朗姆酒换成乌龙茶，椰奶换成泡沫层，层次感更好。',
      },
      // ── 在这里继续添加 Mocktail 类新配方 ──
    ],
  },

  // ══════════════════════════════════════
  // 在这里继续添加新的家族分类
  // ══════════════════════════════════════
]

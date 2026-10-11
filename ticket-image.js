// ============================================================
//  把锁定页的票根画成一张图片
// ============================================================
//  为什么自己用 Canvas 画，而不是引 html2canvas 这类库：
//
//  这个项目一直是零依赖、无构建的纯静态站，加一个 CDN 脚本就多一个
//  国内能不能打开的问题（之前 workers.dev / pages.dev / vercel.app
//  全都试过打不开）。票根的内容就是几行字，自己画完全可控，离线也能用。
//
//  内容从已经渲染好的 #locked-detail 里读，而不是从 plan 状态读——
//  命运模式和周末方案都会把卡片克隆进去，读 DOM 能一套管两种。
// ============================================================

const W = 750;                 // 画布逻辑宽度（竖版，适合发朋友圈/小红书）
const PAD = 48;
const SCALE = 2;               // 两倍图，手机上不糊

const FONT = '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", system-ui, sans-serif';
const INK = "#f6f3ea";
const MUTED = "#b8b2c9";
const PINK = "#ff5c8a";
const LIME = "#d7ff3e";

function font(size, weight = 400) {
  return `${weight} ${size}px ${FONT}`;
}

/** 按宽度折行。Canvas 没有自动换行，只能自己量。 */
function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const ch of String(text || "")) {
    if (ch === "\n") { lines.push(line); line = ""; continue; }
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** 从锁定页的 DOM 里读出要画的内容。命运模式和周末方案的卡片结构不同，都认。 */
function readTicket() {
  const title = (document.getElementById("locked-subtitle").textContent || "").trim();
  const date = (document.getElementById("locked-date").textContent || "").trim();
  const cards = [];
  for (const card of document.querySelectorAll("#locked-detail .place-card")) {
    const kicker = card.querySelector(".plan-kicker, .place-category");
    // .plan-kicker 里是几个并排的 span，靠 CSS 的 gap 分开；
    // textContent 会把它们粘成「主玩美术馆 当代美术馆」，得自己补分隔符
    const kickerSpans = kicker ? [...kicker.querySelectorAll("span")] : [];
    const heading = card.querySelector("h3");
    const kickerText = kickerSpans.length
      ? kickerSpans.map((n) => (n.textContent || "").trim()).filter(Boolean).join(" · ")
      : (kicker ? (kicker.textContent || "").replace(/\s+/g, " ").trim() : "");

    // 命运模式的卡片长得不一样：标题是「2 个」，真正的地名在每一行的 <strong> 里。
    // 只读标题的话，图上会出现「🎨 艺术 / 展览 / 2 个」然后什么地名都没有。
    const rows = [...card.querySelectorAll("p > strong")];
    if (rows.length) {
      const names = rows.map((node) => {
        const line = node.parentElement.cloneNode(true);
        line.querySelectorAll(".place-freshness").forEach((n) => n.remove());
        return (line.textContent || "").replace(/\s+/g, " ").trim();
      }).filter(Boolean);
      const count = heading ? (heading.textContent || "").trim() : "";
      cards.push({
        kicker: [kickerText, count].filter(Boolean).join(" · "),
        title: "",                       // 这一类没有单一主角，列表本身就是内容
        body: names.slice(0, 4),
      });
      continue;
    }

    const body = [];
    for (const node of card.querySelectorAll(".plan-sub, .plan-extra")) {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (text) body.push(text);
    }
    cards.push({
      kicker: kickerText,
      title: heading ? (heading.textContent || "").trim() : "",
      body: body.slice(0, 2),            // 图上只留前两行，再多就太挤
    });
  }
  return { title, date, cards };
}

/** 量一遍高度，再真正画。Canvas 要先知道多高才能开画。 */
function layout(ctx, data) {
  const inner = W - PAD * 2;
  const blocks = [];
  let y = PAD;

  y += 30;                                                      // ✦ 就这么定了
  ctx.font = font(40, 700);
  const titleLines = wrap(ctx, data.title, inner);
  y += 18 + titleLines.length * 52;
  y += 30;                                                      // 日期
  y += 28;                                                      // 虚线

  for (const card of data.cards) {
    const start = y;
    y += card.kicker ? 26 : 0;                                  // kicker
    ctx.font = font(34, 700);
    const lines = card.title ? wrap(ctx, card.title, inner - 36) : [];
    y += (lines.length ? 10 + lines.length * 46 : 8);
    const listy = !lines.length;
    ctx.font = font(listy ? 26 : 22, listy ? 500 : 400);
    const bodyLines = [];
    for (const text of card.body) bodyLines.push(...wrap(ctx, text, inner - 36));
    y += bodyLines.length * (listy ? 38 : 32);
    y += 26;                                                    // 卡片内下边距
    blocks.push({ card, top: start, height: y - start, titleLines: lines, bodyLines });
    y += 16;                                                    // 卡片间距
  }
  y += 24 + 34 + PAD;                                           // 虚线 + 落款
  return { blocks, height: y };
}

function dashedLine(ctx, y) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 画出票根，返回 canvas。 */
export function drawTicket() {
  const data = readTicket();
  const probe = document.createElement("canvas").getContext("2d");
  const { blocks, height } = layout(probe, data);

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "top";

  // 底色：和页面同一套暗色，右上角带一点粉
  ctx.fillStyle = "#0b0a12";
  ctx.fillRect(0, 0, W, height);
  const glow = ctx.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, W * 1.1);
  glow.addColorStop(0, "rgba(255,92,138,0.22)");
  glow.addColorStop(1, "rgba(255,92,138,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, height);

  let y = PAD;
  ctx.fillStyle = PINK;
  ctx.font = font(22, 600);
  ctx.fillText("✦ 就这么定了", PAD, y);
  y += 30 + 18;

  ctx.fillStyle = INK;
  ctx.font = font(40, 700);
  for (const line of wrap(ctx, data.title, W - PAD * 2)) {
    ctx.fillText(line, PAD, y);
    y += 52;
  }

  ctx.fillStyle = MUTED;
  ctx.font = font(21);
  ctx.fillText(data.date, PAD, y);
  y += 30;
  dashedLine(ctx, y + 12);
  y += 28;

  for (const block of blocks) {
    const h = block.height;
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    roundRect(ctx, PAD - 10, y, W - PAD * 2 + 20, h, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();

    let ty = y + 18;
    if (block.card.kicker) {
      ctx.fillStyle = LIME;
      ctx.font = font(20, 600);
      ctx.fillText(block.card.kicker, PAD + 8, ty);
      ty += 26;
    }
    ty += block.titleLines.length ? 10 : 8;
    ctx.fillStyle = INK;
    ctx.font = font(34, 700);
    for (const line of block.titleLines) { ctx.fillText(line, PAD + 8, ty); ty += 46; }
    const listy = !block.titleLines.length;
    ctx.fillStyle = listy ? INK : MUTED;
    ctx.font = font(listy ? 26 : 22, listy ? 500 : 400);
    for (const line of block.bodyLines) { ctx.fillText(line, PAD + 8, ty); ty += listy ? 38 : 32; }
    y += h + 16;
  }

  dashedLine(ctx, y + 12);
  y += 24;
  ctx.fillStyle = MUTED;
  ctx.font = font(20);
  ctx.fillText("周末别想了 · junnnnnn-sketch.github.io/weekend-random", PAD, y);
  return canvas;
}

/**
 * 存图。
 *
 * 桌面和安卓用 <a download> 直接下载；iOS Safari 对 download 支持得很怪
 * （常常是直接打开而不是保存），所以统一把图也显示在页面上，
 * 长按就能存——与其猜平台，不如两条路都给。
 */
export function saveTicket(mountNode) {
  const canvas = drawTicket();
  const url = canvas.toDataURL("image/png");
  const stamp = new Date().toISOString().slice(0, 10);

  const link = document.createElement("a");
  link.href = url;
  link.download = `周末别想了-${stamp}.png`;
  document.body.append(link);
  link.click();
  link.remove();

  if (mountNode) {
    mountNode.replaceChildren();
    const image = document.createElement("img");
    image.src = url;
    image.alt = "周末方案票根";
    image.className = "ticket-shot";
    const hint = document.createElement("p");
    hint.className = "ticket-foot";
    hint.textContent = "没自动下载的话，长按或右键这张图保存";
    mountNode.append(image, hint);
  }
  return url;
}

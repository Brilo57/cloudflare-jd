// 支持：网页版/移动端数字链接、3.cn 短链、京粉加密链接、u.jd.com 推广链接
const JD_LINK_REGEX =
  /https?:\/\/(?:item(?:\.m)?\.jd\.com\/(?:product\/)?\d+(?:\.html)?|3\.cn\/[A-Za-z0-9_-]+|jingfen\.jd\.com\/detail\/[A-Za-z0-9_-]+\.html|u\.jd\.com\/[A-Za-z0-9_-]+)/i;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}

export function extractJdLink(rawInput) {
  if (!rawInput) {
    return null;
  }

  const match = String(rawInput).trim().match(JD_LINK_REGEX);
  return match ? match[0] : null;
}

function normalizeItem(item) {
  const firstImage = item.small_images ? String(item.small_images).split("|")[0] : item.pict_url || "";

  return {
    title: item.title || "",
    shop_title: item.shop_title || "",
    price_after_coupon: item.quanhou_jiage || "",
    commission: item.tkfee3 || "",
    description: item.jianjie || "",
    buy_url: item.shorturl || "",
    image_url: firstImage || "",
    limited: false
  };
}

function buildLinkOnlyItem(data) {
  return {
    title: "",
    shop_title: "",
    price_after_coupon: "",
    commission: "",
    description: "",
    buy_url: data.shortURL || data.clickURL || "",
    image_url: "",
    limited: true
  };
}

function clarifyError(message) {
  if (/不支持数字id转链/.test(message)) {
    return (
      message +
      " 该链接是网页版数字商品链接，京东联盟已限制此类链接转链，请改用京东 App 分享的 3.cn 链接或京粉链接重试。"
    );
  }
  return message;
}

// 折淘客/折京客接口存在两类返回结构，这里做兼容解析：
// 1) 折淘客统一包装：{ status: 200, content: [商品...] } 或 { status: 301, content: "错误文案" }
// 2) 京东原生包装：{ jd_union_open_promotion_byunionid_get_response: { code: "0", result: "{...}" } }
export function parseUpstreamResult(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "上游返回了无法识别的数据结构。" };
  }

  if (typeof body.status === "number") {
    if (body.status !== 200) {
      const message =
        typeof body.content === "string" && body.content
          ? clarifyError(body.content)
          : `折淘客接口返回错误（status=${body.status}）。`;
      return { ok: false, error: message };
    }

    const list = Array.isArray(body.content) ? body.content : [];
    const item = list[0];
    if (!item) {
      return { ok: false, error: "接口返回成功，但没有查询到商品数据。" };
    }
    return { ok: true, item: normalizeItem(item) };
  }

  const jdResponse = body.jd_union_open_promotion_byunionid_get_response;
  if (!jdResponse || typeof jdResponse !== "object") {
    return { ok: false, error: "上游返回了无法识别的数据结构，请检查接口配置或联系折淘客。" };
  }

  if (jdResponse.code !== "0" && jdResponse.code !== 0) {
    return { ok: false, error: `京东接口调用失败（code=${jdResponse.code}）。` };
  }

  let inner;
  try {
    inner = JSON.parse(jdResponse.result);
  } catch {
    return { ok: false, error: "京东接口返回的数据不是有效 JSON，请检查上游响应。" };
  }

  if (!inner || inner.code !== 200) {
    const message = inner && inner.message ? inner.message : "京东转链失败";
    const code = inner && inner.code !== undefined ? `（code=${inner.code}）` : "";
    return { ok: false, error: `${message}${code}` };
  }

  const data = inner.data || {};
  if (!data.shortURL && !data.clickURL) {
    return { ok: false, error: "京东转链成功，但没有返回推广链接。" };
  }

  return { ok: true, item: buildLinkOnlyItem(data) };
}

export async function onRequestPost(context) {
  const { env, request } = context;

  if (!env.APPKEY || !env.UNION_ID) {
    return json(
      {
        ok: false,
        error: "Cloudflare 环境变量未配置完整，请设置 APPKEY 和 UNION_ID。"
      },
      500
    );
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "请求体格式不正确。" }, 400);
  }

  const extractedLink = extractJdLink(payload.jd_link);
  if (!extractedLink) {
    return json(
      {
        ok: false,
        error:
          "没有识别到有效的京东链接。支持京东 App 分享的 3.cn 短链、京粉加密链接（jingfen.jd.com）、u.jd.com 推广链接及 item.jd.com 商品页。"
      },
      400
    );
  }

  const upstreamUrl = new URL("http://j.zhetaoke.com/api/open_jing_union_open_promotion_byunionid_get.ashx");
  upstreamUrl.searchParams.set("appkey", env.APPKEY);
  upstreamUrl.searchParams.set("materialId", extractedLink);
  upstreamUrl.searchParams.set("unionId", env.UNION_ID);
  upstreamUrl.searchParams.set("couponUrl", "");
  upstreamUrl.searchParams.set("positionId", env.POSITION_ID || "111");
  upstreamUrl.searchParams.set("giftCouponKey", "");
  upstreamUrl.searchParams.set("chainType", "3");
  upstreamUrl.searchParams.set("signurl", "5");

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      method: "POST",
      headers: {
        accept: "application/json"
      }
    });

    if (!upstream.ok) {
      let message = `上游接口请求失败（HTTP ${upstream.status}）。`;
      try {
        const body = await upstream.json();
        if (body && typeof body.content === "string" && body.content) {
          message = body.content;
        } else if (body && typeof body.message === "string" && body.message) {
          message = body.message;
        }
      } catch {
        // 保留默认提示，HTML 错误页不尝试解析
      }
      return json({ ok: false, error: message }, 502);
    }

    let result;
    try {
      result = await upstream.json();
    } catch {
      const rawText = await upstream.text().catch(() => "");
      const snippet = rawText ? rawText.slice(0, 200) : "（空响应）";
      return json({ ok: false, error: `上游返回内容不是有效 JSON，请检查接口状态。原始内容：${snippet}` }, 502);
    }

    const parsed = parseUpstreamResult(result);

    if (!parsed.ok) {
      return json({ ok: false, error: parsed.error }, 502);
    }

    return json({
      ok: true,
      item: parsed.item
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "请求失败，请稍后重试。"
      },
      500
    );
  }
}

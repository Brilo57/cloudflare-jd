const form = document.getElementById("jd-form");
const input = document.getElementById("jd-input");
const submitButton = document.getElementById("submit-button");
const buyButton = document.getElementById("buy-button");
const resetButton = document.getElementById("reset-button");
const statusCard = document.getElementById("status-card");
const statusText = document.getElementById("status-text");
const resultCard = document.getElementById("result-card");
const resultTitle = document.getElementById("result-title");
const resultShop = document.getElementById("result-shop");
const resultPrice = document.getElementById("result-price");
const resultOriginal = document.getElementById("result-original");
const resultDesc = document.getElementById("result-desc");
const metaList = document.getElementById("meta-list");

let currentBuyUrl = "";

function showStatus(message, isError = false) {
  statusText.textContent = message;
  statusCard.classList.remove("hidden");
  statusCard.classList.toggle("error", isError);
}

function hideStatus() {
  statusCard.classList.add("hidden");
  statusCard.classList.remove("error");
  statusText.textContent = "";
}

function hideResult() {
  resultCard.classList.add("hidden");
  currentBuyUrl = "";
}

function renderMeta(items) {
  metaList.innerHTML = "";

  items.forEach(([label, value]) => {
    if (!value && value !== 0) {
      return;
    }

    const wrapper = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    wrapper.append(dt, dd);
    metaList.appendChild(wrapper);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const rawValue = input.value.trim();
  if (!rawValue) {
    showStatus("请先粘贴京东链接或分享文案。", true);
    hideResult();
    return;
  }

  submitButton.disabled = true;
  hideResult();
  showStatus("正在查询，请稍候...");

  try {
    const response = await fetch("/api/jd", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ jd_link: rawValue })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "查询失败，请稍后重试。");
    }

    const item = data.item;
    currentBuyUrl = item.buy_url || "";

    resultTitle.textContent = item.title || "未命名商品";
    resultShop.textContent = item.shop_title || "店铺信息暂无";
    resultPrice.textContent = item.price_after_coupon ? `¥${item.price_after_coupon}` : "暂无";
    resultOriginal.textContent = item.original_price ? `¥${item.original_price}` : "暂无";

    const desc = item.description ? String(item.description).trim() : "";
    resultDesc.textContent = desc;
    resultDesc.classList.toggle("hidden", !desc);

    renderMeta([
      ["优惠券", item.coupon_info || "暂无"],
      ["返利", item.commission ? `¥${item.commission}` : "暂无"],
      ["月销量", item.volume || "暂无"],
      ["好评率", item.good_rate ? `${item.good_rate}%` : "暂无"]
    ]);

    resultCard.classList.remove("hidden");
    hideStatus();
  } catch (error) {
    showStatus(error.message || "查询失败，请稍后重试。", true);
    hideResult();
  } finally {
    submitButton.disabled = false;
  }
});

buyButton.addEventListener("click", () => {
  if (!currentBuyUrl) {
    showStatus("没有可打开的购买链接。", true);
    return;
  }

  window.location.href = currentBuyUrl;
});

resetButton.addEventListener("click", () => {
  input.value = "";
  hideStatus();
  hideResult();
  input.focus();
});

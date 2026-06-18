export function parseInvoiceFields(text) {
  if (!text || typeof text !== 'string') {
    return {
      invoice_no: null,
      invoice_code: null,
      amount: null,
      tax_amount: null,
      total_amount: null,
      invoice_date: null,
      seller_name: null,
      seller_tax_no: null,
      buyer_name: null,
      buyer_tax_no: null,
      confidence: 0,
    };
  }

  const fields = {
    invoice_no: null,
    invoice_code: null,
    amount: null,
    tax_amount: null,
    total_amount: null,
    invoice_date: null,
    seller_name: null,
    seller_tax_no: null,
    buyer_name: null,
    buyer_tax_no: null,
    confidence: 0,
  };

  let confidence = 0;

  const invoiceNoMatch = text.match(/(?:发票号码|No\.|号码)[:：\s]*([0-9]{8,20})/i);
  if (invoiceNoMatch) {
    fields.invoice_no = invoiceNoMatch[1];
    confidence += 10;
  }

  const invoiceCodeMatch = text.match(/(?:发票代码|代码)[:：\s]*([0-9]{10,15})/i);
  if (invoiceCodeMatch) {
    fields.invoice_code = invoiceCodeMatch[1];
    confidence += 10;
  }

  const dateMatch = text.match(/(?:开票日期|日期)[:：\s]*(\d{4}[-年\/]\d{1,2}[-月\/]\d{1,2})/i);
  if (dateMatch) {
    let dateStr = dateMatch[1];
    dateStr = dateStr.replace(/年|月/g, '-').replace(/日/g, '');
    const parts = dateStr.split(/[-\/]/);
    if (parts.length === 3) {
      const year = parts[0].padStart(4, '20');
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      fields.invoice_date = `${year}-${month}-${day}`;
      confidence += 15;
    }
  }

  const totalAmountMatch = text.match(/(?:价税合计|合计金额|总计|总金额|金额合计)[:：\s]*[¥￥$]?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
  if (totalAmountMatch) {
    fields.total_amount = parseFloat(totalAmountMatch[1].replace(/,/g, ''));
    confidence += 20;
  }

  if (!fields.total_amount) {
    const amountMatches = text.match(/[¥￥$]\s*([0-9]+(?:[.,][0-9]{1,2})?)/g);
    if (amountMatches && amountMatches.length > 0) {
      const amounts = amountMatches.map(m => parseFloat(m.replace(/[¥￥$,]/g, '')));
      fields.total_amount = Math.max(...amounts);
      confidence += 10;
    }
  }

  const amountMatch = text.match(/(?:金额|价款)[:：\s]*[¥￥$]?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
  if (amountMatch) {
    fields.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    confidence += 10;
  }

  const taxAmountMatch = text.match(/(?:税额|税金)[:：\s]*[¥￥$]?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
  if (taxAmountMatch) {
    fields.tax_amount = parseFloat(taxAmountMatch[1].replace(/,/g, ''));
    confidence += 10;
  }

  if (!fields.amount && fields.total_amount && fields.tax_amount) {
    fields.amount = parseFloat((fields.total_amount - fields.tax_amount).toFixed(2));
  }

  const sellerNameMatch = text.match(/(?:销售方|销货方|卖方|收款方|开票方)[^]*?名称[:：\s]*([^\n\r，。、]+)/i);
  if (sellerNameMatch) {
    fields.seller_name = sellerNameMatch[1].trim();
    confidence += 15;
  }

  if (!fields.seller_name) {
    const sellerAltMatch = text.match(/名称[:：\s]*([^\n\r，。、]+)[\s\S]*?纳税人识别号[:：\s]*([0-9A-Z]{15,20})/i);
    if (sellerAltMatch) {
      fields.seller_name = sellerAltMatch[1].trim();
      fields.seller_tax_no = sellerAltMatch[2];
      confidence += 20;
    }
  }

  const sellerTaxNoMatch = text.match(/(?:销售方|销货方)[^]*?(?:纳税人识别号|税号)[:：\s]*([0-9A-Z]{15,20})/i);
  if (sellerTaxNoMatch) {
    fields.seller_tax_no = sellerTaxNoMatch[1];
    confidence += 10;
  }

  const buyerNameMatch = text.match(/(?:购买方|购货方|买方|付款方)[^]*?名称[:：\s]*([^\n\r，。、]+)/i);
  if (buyerNameMatch) {
    fields.buyer_name = buyerNameMatch[1].trim();
    confidence += 15;
  }

  const buyerTaxNoMatch = text.match(/(?:购买方|购货方)[^]*?(?:纳税人识别号|税号)[:：\s]*([0-9A-Z]{15,20})/i);
  if (buyerTaxNoMatch) {
    fields.buyer_tax_no = buyerTaxNoMatch[1];
    confidence += 10;
  }

  const taxNoPattern = /[0-9A-Z]{15,20}/g;
  const taxNos = text.match(taxNoPattern);
  if (taxNos && taxNos.length >= 2) {
    if (!fields.buyer_tax_no) fields.buyer_tax_no = taxNos[0];
    if (!fields.seller_tax_no) fields.seller_tax_no = taxNos[1];
    confidence += 5;
  }

  fields.confidence = Math.min(100, confidence);

  return fields;
}

export function detectInvoiceCategory(text, fields) {
  const categories = {
    '餐饮费用': ['餐饮', '餐厅', '饭店', '酒店', '酒楼', '美食', '快餐', '食品', '餐饮服务', '餐费'],
    '差旅费用': ['住宿', '宾馆', '酒店', '旅馆', '民宿', '机票', '航空', '火车', '高铁', '动车', '出租', '滴滴', '网约车'],
    '办公费用': ['办公', '文具', '打印', '耗材', '设备', '电脑', '软件', '技术服务', '咨询', '会议', '培训'],
    '交通费用': ['加油', '汽油', '柴油', '停车', '过路费', '高速', '汽车维修', '车辆', '保险', '车船'],
    '采购费用': ['采购', '货物', '材料', '原料', '商品', '批发', '零售'],
  };

  const fullText = text + (fields?.seller_name || '') + (fields?.buyer_name || '');
  
  for (const [category, keywords] of Object.entries(categories)) {
    for (const keyword of keywords) {
      if (fullText.includes(keyword)) {
        return category;
      }
    }
  }

  return '其他费用';
}

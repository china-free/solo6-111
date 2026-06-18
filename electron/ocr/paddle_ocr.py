#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PaddleOCR 识别脚本
从命令行接收图片路径，返回 OCR 识别结果的 JSON
"""

import sys
import json
import os

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "缺少图片路径参数"}))
        return
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(json.dumps({"success": False, "error": "文件不存在"}))
        return
    
    try:
        from paddleocr import PaddleOCR
        
        ocr = PaddleOCR(use_angle_cls=True, lang='ch', show_log=False)
        result = ocr.ocr(image_path, cls=True)
        
        texts = []
        if result and result[0]:
            for line in result[0]:
                text = line[1][0]
                texts.append(text)
        
        full_text = '\n'.join(texts)
        
        print(json.dumps({
            "success": True,
            "text": full_text,
            "line_count": len(texts)
        }, ensure_ascii=False))
        
    except ImportError:
        print(json.dumps({"success": False, "error": "PaddleOCR 未安装"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == '__main__':
    main()

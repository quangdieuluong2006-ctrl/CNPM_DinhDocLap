-- Bộ lọc pandoc khi xuất docs/PRD.md sang Word: đặt độ rộng ảnh, bỏ đánh số các mục đầu/phụ lục.
-- Dùng: pandoc docs/PRD.md --resource-path=docs --lua-filter=docs/tools/prd-docx.lua
--        --reference-doc=docs/tools/reference.docx --number-sections --toc -o docs/PRD_Thuyet_Minh_Dinh_Doc_Lap_v2.2.docx
local widths = {
  context = 95, components = 95, class_mobile = 95, st_geofence = 80, act_geofence = 45,
  act_qr = 70, uc = 78, sd01 = 98, sd02 = 95, sd03 = 98, sd04 = 98, sd05 = 95,
  st_content = 45, ui_mobile = 100, ui_web_user = 95, ui_admin_dashboard = 95,
  ui_admin_active = 95, erd = 100, cicd = 45, map_points = 80, dfd0 = 100,
  -- Lược đồ hoạt động (mục 8.4): độ rộng tính để cả lược đồ vừa một trang A4
  act_uc01 = 100, act_uc02 = 37, act_uc03 = 76, act_uc04 = 47, act_uc05 = 43, act_uc08 = 100, act_uc09 = 100, act_uc10 = 100, act_uc11 = 91, act_uc12 = 100, act_uc13 = 100, act_uc14 = 100, act_uc15 = 100, act_uc16 = 80, act_uc17 = 100, act_uc18 = 75, act_uc19 = 85, act_uc20 = 96,
}

function Image(img)
  local name = img.src:match("([%w_]+)%.png$")
  if name and widths[name] then img.attributes.width = widths[name] .. "%" end
  return img
end

local unnumbered = { "^Lịch sử thay đổi", "^Cách đọc", "^Danh mục hình", "^Phụ lục" }

function Header(h)
  local text = pandoc.utils.stringify(h)
  for _, pat in ipairs(unnumbered) do
    if text:match(pat) then h.classes:insert("unnumbered") end
  end
  return h
end

-- DFD mức 1 (mục 13.2) rất rộng: đặt riêng trên một trang A4 nằm ngang để chữ đủ lớn.
-- Đoạn trống mang sectPr kết thúc phần dọc phía trước; đoạn trống sau hình kết thúc phần ngang.
local function sect(landscape)
  local size = landscape and '<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>' or '<w:pgSz w:w="11906" w:h="16838"/>'
  local mar = landscape and '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/>'
    or '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1418" w:header="567" w:footer="567" w:gutter="0"/>'
  return pandoc.RawBlock("openxml", '<w:p><w:pPr><w:sectPr>' .. size .. mar .. '</w:sectPr></w:pPr></w:p>')
end

function Figure(fig)
  local wide = false
  fig = fig:walk({ Image = function(img)
    if img.src:match("dfd1%.png$") then wide = true; img.attributes.width = "25cm" end
    return img
  end })
  if wide then return { sect(false), fig, sect(true) } end
  return fig
end

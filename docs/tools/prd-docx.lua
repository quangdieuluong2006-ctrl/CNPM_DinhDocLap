-- Bộ lọc pandoc khi xuất docs/PRD.md sang Word: đặt độ rộng ảnh, bỏ đánh số các mục đầu/phụ lục.
-- Dùng: pandoc docs/PRD.md --resource-path=docs --lua-filter=docs/tools/prd-docx.lua
--        --reference-doc=docs/tools/reference.docx --number-sections --toc -o docs/PRD_Thuyet_Minh_Dinh_Doc_Lap_v2.0.docx
local widths = {
  context = 95, components = 95, class_mobile = 95, st_geofence = 80, act_geofence = 45,
  act_qr = 70, uc = 78, sd01 = 98, sd02 = 95, sd03 = 98, sd04 = 98, sd05 = 95,
  st_content = 45, ui_mobile = 100, ui_web_user = 95, ui_admin_dashboard = 95,
  ui_admin_active = 95, erd = 100, cicd = 45, map_points = 80,
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

from pathlib import Path
import fitz

source = Path("attached_assets/DBT_Properties_Sales_Brochure_20260528_105101_0000_1789636918574.pdf")
output = Path(".agents/outputs/brochure-reference-latest")
output.mkdir(parents=True, exist_ok=True)

doc = fitz.open(source)
print(f"pages={doc.page_count}")
print(f"page_size_points={doc[0].rect.width:.1f}x{doc[0].rect.height:.1f}")

pages = sorted({0, 1, 2, 3, 4, 34})
matrix = fitz.Matrix(1.5, 1.5)
for index in pages:
    page = doc[index]
    path = output / f"page-{index + 1}.png"
    page.get_pixmap(matrix=matrix, alpha=False).save(path)
    print(path)
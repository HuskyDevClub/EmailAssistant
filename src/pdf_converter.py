from flask import Flask, request, jsonify
from pdf2image import convert_from_path
import os

app = Flask(__name__)
OUTPUT_FOLDER = "output_images"
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

@app.route("/convert-pdf", methods=["POST"])
def convert_pdf():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    pdf_path = os.path.join(OUTPUT_FOLDER, file.filename)
    file.save(pdf_path)

    images = convert_from_path(pdf_path, dpi=300)
    image_paths = []

    for i, img in enumerate(images):
        img_path = os.path.join(OUTPUT_FOLDER, f"{file.filename}_page_{i + 1}.png")
        img.save(img_path, "PNG")
        image_paths.append(img_path)

    return jsonify({"images": image_paths})

if __name__ == "__main__":
    app.run(port=5001)


# ✨ TinyPixel Studio

TinyPixel Studio is a high-performance, lightweight pixel art editor that runs in your browser.
Optimized for both PC and mobile, it features intuitive controls and advanced image conversion capabilities.

## 🚀 Key Features

- **High-Performance Drawing System**: A Canvas-based engine that runs smoothly even on low-spec devices.
- **Multi-Device Support**: Full support for mouse input on PC, as well as touch gestures and pinch-to-zoom on mobile.
- **Pixelate Converter**: 
  - Convert arbitrary images into high-quality pixel art.
  - **Median-Cut Algorithm**: Automatically generates the optimal color palette from the image.
  - **Floyd-Steinberg Dithering**: Expresses rich gradients with a limited number of colors.
  - **3 Conversion Modes**: COVER (Crop), CONTAIN (Fit), STRETCH (Resize).
- **Intelligent Canvas Operations**:
  - Supports arithmetic operations in input fields (e.g., `32 * 2`).
  - Flexible resizing with 9-direction anchor specification.
- **Data Persistence**: Uses browser LocalStorage to automatically save your work. Instantly recover after a crash or reload.
- **Versatile Export**: Supports PNG and SVG formats.
- **Offline Capable (PWA)**: Works without an internet connection once loaded.

## 🛠 Techniques & Architecture

### Image Processing Algorithms
The following logic is employed as the core of the pixel art conversion:
1. **Geometry Phase**: Resizes to low resolution using Nearest Neighbor interpolation based on the specified anchor and mode.
2. **Quantization**: Generates a color palette capturing the input image's features using the Median-Cut method.
3. **Dithering**: Reproduces smooth gradients by diffusing quantization errors to adjacent pixels using the Floyd-Steinberg method.

### Performance Optimization
- **Canvas API**: Minimizes DOM elements by consolidating drawing operations into the Canvas.
- **Debouncing**: Heavy processes like Pixelate previews wait for user input to stop before executing, preventing UI freezes.
- **Image Rendering**: Utilizes CSS `image-rendering: pixelated` to display crisp pixels without blurring even when zoomed in.

## 📖 Usage

### Basic Operations
- **Pen/Eraser**: Draw and erase pixels.
- **Fill (Bucket)**: Change valid adjacent colored areas at once.
- **Eyedropper**: Pick colors from the canvas.
- **Zoom**: Zoom in/out using the mouse wheel or pinch gestures.

### Pixelate Converter
1. Click the "✨ Pixelate" button in the header.
2. Select an image.
3. Set the output size (Width/Height).
4. Select palette color count (8-256, or Original).
5. Enable dithering if necessary.
6. Click "Apply to Editor" to reflect changes on the canvas.

## 📝 Tech Stack
- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS
- **Icons/UI**: Lucide-like custom SVG icons
- **Runtime**: ESM.sh (No build step required for browser execution)

---

Developed with ❤️ by Senior Frontend Engineer.

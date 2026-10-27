# Resources

`ssd-mobilenet-v1-12-int8.onnx` is the quantized SSD-MobileNetV1 model from the
ONNX Model Zoo, pinned to commit
`4c46cd00fbdb7cd30b6c1c17ab54f2e1f4f7b177`. It is configured as a bundled
resource in the native Xcode target, not in the web build. See `LICENSE` for
the MIT license.

The existing model is used directly with ONNX Runtime for iOS. It has not been
converted to Core ML; its dynamic NHWC input and Loop-based postprocessing
would require a separate conversion and output-parity validation.

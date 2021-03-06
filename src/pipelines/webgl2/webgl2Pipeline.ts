import { BackgroundConfig } from '../../core/helpers/backgroundHelper'
import { PostProcessingConfig } from '../../core/helpers/postProcessingHelper'
import {
  inputResolutions,
  SegmentationConfig,
} from '../../core/helpers/segmentationHelper'
import { SourcePlayback } from '../../core/helpers/sourceHelper'
import { TFLite } from '../../core/hooks/useTFLite'
import { compileShader, createTexture, glsl } from '../helpers/webglHelper'
import { buildBackgroundBlurStage } from './backgroundBlurStage'
import {
  BackgroundImageStage,
  buildBackgroundImageStage,
} from './backgroundImageStage'
import { buildJointBilateralFilterStage } from './jointBilateralFilterStage'
import { buildResizingStage } from './resizingStage'
import { buildSoftmaxStage } from './softmaxStage'

export function buildWebGL2Pipeline(
  sourcePlayback: SourcePlayback,
  backgroundImage: HTMLImageElement | null,
  backgroundConfig: BackgroundConfig,
  segmentationConfig: SegmentationConfig,
  canvas: HTMLCanvasElement,
  tflite: TFLite,
  addFrameEvent: () => void
) {
  const vertexShaderSource = glsl`#version 300 es

    in vec2 a_position;
    in vec2 a_texCoord;

    out vec2 v_texCoord;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `

  const { width: frameWidth, height: frameHeight } = sourcePlayback
  const [segmentationWidth, segmentationHeight] = inputResolutions[
    segmentationConfig.inputResolution
  ]

  const gl = canvas.getContext('webgl2')!

  // TODO Check if the extension is available otherwise convert to floats on CPU
  gl.getExtension('EXT_color_buffer_float')

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource)

  const vertexArray = gl.createVertexArray()
  gl.bindVertexArray(vertexArray)

  const positionBuffer = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]),
    gl.STATIC_DRAW
  )

  const texCoordBuffer = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0]),
    gl.STATIC_DRAW
  )

  const inputFrameTexture = createTexture(gl, gl.RGBA8, frameWidth, frameHeight)
  // TODO Rename segmentation and person mask to be more specific
  const segmentationTexture = createTexture(
    gl,
    gl.RGBA8,
    segmentationWidth,
    segmentationHeight
  )!
  const personMaskTexture = createTexture(
    gl,
    gl.RGBA8,
    frameWidth,
    frameHeight
  )!

  const resizingStage = buildResizingStage(
    gl,
    vertexShader,
    positionBuffer,
    texCoordBuffer,
    segmentationConfig,
    tflite
  )
  const softmaxStage = buildSoftmaxStage(
    gl,
    vertexShader,
    positionBuffer,
    texCoordBuffer,
    segmentationConfig,
    tflite,
    segmentationTexture
  )
  const jointBilateralFilterStage = buildJointBilateralFilterStage(
    gl,
    vertexShader,
    positionBuffer,
    texCoordBuffer,
    segmentationTexture,
    segmentationConfig,
    personMaskTexture,
    canvas
  )
  const backgroundStage =
    backgroundConfig.type === 'blur'
      ? buildBackgroundBlurStage(
          gl,
          positionBuffer,
          texCoordBuffer,
          personMaskTexture,
          canvas
        )
      : buildBackgroundImageStage(
          gl,
          positionBuffer,
          texCoordBuffer,
          personMaskTexture,
          backgroundImage,
          canvas
        )

  async function render() {
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, inputFrameTexture)
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      frameWidth,
      frameHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      sourcePlayback.htmlElement
    )

    gl.bindVertexArray(vertexArray)

    resizingStage.render()

    addFrameEvent()

    tflite._runInference()

    addFrameEvent()

    softmaxStage.render()
    jointBilateralFilterStage.render()
    backgroundStage.render()
  }

  function updatePostProcessingConfig(
    postProcessingConfig: PostProcessingConfig
  ) {
    jointBilateralFilterStage.updateSigmaSpace(
      postProcessingConfig.jointBilateralFilter.sigmaSpace
    )
    jointBilateralFilterStage.updateSigmaColor(
      postProcessingConfig.jointBilateralFilter.sigmaColor
    )
    // TODO Handle no background in a separate pipeline path
    if (backgroundConfig.type === 'none') {
      const backgroundImageStage = backgroundStage as BackgroundImageStage
      backgroundImageStage.updateCoverage([0, 0.9999])
      backgroundImageStage.updateLightWrapping(0)
    } else if (backgroundConfig.type === 'image') {
      const backgroundImageStage = backgroundStage as BackgroundImageStage
      backgroundImageStage.updateCoverage(postProcessingConfig.coverage)
      backgroundImageStage.updateLightWrapping(
        postProcessingConfig.lightWrapping
      )
      backgroundImageStage.updateBlendMode(postProcessingConfig.blendMode)
    }
  }

  function cleanUp() {
    backgroundStage.cleanUp()
    jointBilateralFilterStage.cleanUp()
    softmaxStage.cleanUp()
    resizingStage.cleanUp()

    gl.deleteTexture(personMaskTexture)
    gl.deleteTexture(segmentationTexture)
    gl.deleteTexture(inputFrameTexture)
    gl.deleteBuffer(texCoordBuffer)
    gl.deleteBuffer(positionBuffer)
    gl.deleteVertexArray(vertexArray)
    gl.deleteShader(vertexShader)
  }

  return { render, updatePostProcessingConfig, cleanUp }
}

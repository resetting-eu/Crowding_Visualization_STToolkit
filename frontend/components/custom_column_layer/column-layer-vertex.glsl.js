// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

export default `#version 300 es

#define SHADER_NAME column-layer-vertex-shader

in vec3 positions;
in vec3 normals;

in vec3 instancePositions;
in vec4 instanceElevations0to3;
//in float instanceElevations0;
//in float instanceElevations1;
//in float instanceElevations2;
//in float instanceElevations3;
in float instanceElevations4;
in vec3 instancePositions64Low;
in vec4 instanceFillColors1;
in vec4 instanceFillColors2;
in vec4 quartileColors;
in vec4 instanceLineColors;
in float instanceStrokeWidths;
in float visualizeUncertainty;

in vec3 instancePickingColors;
in float paintTopFace;

// Custom uniforms
uniform float opacity;
uniform float radius;
uniform float radiusSmall;
uniform float angle;
uniform vec2 offset;
uniform bool extruded;
uniform bool stroked;
uniform bool isStroke;
uniform float coverage;
uniform float elevationScale;
uniform float edgeDistance;
uniform float widthScale;
uniform float widthMinPixels;
uniform float widthMaxPixels;
uniform int radiusUnits;
uniform int widthUnits;
uniform int nColumn;

// Result
out vec4 vColor;
#ifdef FLAT_SHADING
out vec4 position_commonspace;
#endif

void main(void) {
  geometry.worldPosition = instancePositions;

  //vec4 color = isStroke ? instanceLineColors : instanceFillColors;
  // rotate primitive position and normal
  vec4 color;
  mat2 rotationMatrix = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));

  // calculate elevation, if 3d not enabled set to 0
  // cylindar gemoetry height are between -1.0 to 1.0, transform it to between 0, 1
  float elevation = 0.0;
  // calculate stroke offset
  float strokeOffsetRatio = 1.0;

  float instanceElevations0 = instanceElevations0to3.x;
  float instanceElevations1 = instanceElevations0to3.y;
  float instanceElevations2 = instanceElevations0to3.z;
  float instanceElevations3 = instanceElevations0to3.w;

  if (extruded) {
    if(visualizeUncertainty == 1.0) {
      if(nColumn == 0) {
        if(positions.z < 0.0) {
          elevation = instanceElevations0 * elevationScale;
        } else {
          elevation = instanceElevations4 * elevationScale + 1.0;
        }
        color = instanceFillColors1;
      } else if(nColumn == 1) {
        if(positions.z < 0.0) {
          elevation = instanceElevations1 * elevationScale;      
        } else {
          elevation = instanceElevations2 * elevationScale;
        }
        color = instanceFillColors1;
      } else if(nColumn == 2) {
        if(positions.z < 0.0) {
          elevation = instanceElevations2 * elevationScale;
        } else {
          elevation = instanceElevations2 * elevationScale + 5.0;
        }
        color = quartileColors;
      } else if(nColumn == 3) {
        if(positions.z < 0.0) {
          elevation = instanceElevations2 * elevationScale + 5.0;  
        } else {
          elevation = instanceElevations3 * elevationScale + 5.0;
        }
        color = instanceFillColors1;;
      } else { // nColumn == 4
        if(positions.z < 0.0) {
          elevation = 0.0;
        } else {
          elevation = instanceElevations4 * elevationScale + 5.0;
        }
        color = instanceFillColors2;
      }
    } else {
      elevation = instanceElevations2 * (positions.z + 1.0) / 2.0 * elevationScale;
      color = instanceFillColors1;
    }
  } else if (stroked) {
    float widthPixels = clamp(
      project_size_to_pixel(instanceStrokeWidths * widthScale, widthUnits),
      widthMinPixels, widthMaxPixels) / 2.0;
    float halfOffset = project_pixel_size(widthPixels) / project_size(edgeDistance * coverage * radius);
    if (isStroke) {
      strokeOffsetRatio -= sign(positions.z) * halfOffset;
    } else {
      strokeOffsetRatio -= halfOffset;
    }
  }

  // if alpha == 0.0 or z < 0.0, do not render element
  float shouldRender = float(color.a > 0.0 && instanceElevations1 >= 0.0 && instanceElevations2 >= 0.0);
  float dotRadius = (nColumn == 0 ? radiusSmall : radius) * coverage * shouldRender;

  geometry.pickingColor = instancePickingColors;

  // project center of column
  vec3 centroidPosition = vec3(instancePositions.xy, instancePositions.z + elevation);
  vec3 centroidPosition64Low = instancePositions64Low;
  vec2 offset = (rotationMatrix * positions.xy * strokeOffsetRatio + offset) * dotRadius;
  if (radiusUnits == UNIT_METERS) {
    offset = project_size(offset);
  }
  vec3 pos = vec3(offset, 0.);
  DECKGL_FILTER_SIZE(pos, geometry);

  gl_Position = project_position_to_clipspace(centroidPosition, centroidPosition64Low, pos, geometry.position);
  geometry.normal = project_normal(vec3(rotationMatrix * normals.xy, normals.z));
  DECKGL_FILTER_GL_POSITION(gl_Position, geometry);

  // Light calculations
  if (extruded && !isStroke) {
#ifdef FLAT_SHADING
    position_commonspace = geometry.position;
    vColor = vec4(color.rgb, color.a * opacity);
#else
    vec3 lightColor = lighting_getLightColor(color.rgb, project_uCameraPosition, geometry.position.xyz, geometry.normal);
    vColor = vec4(lightColor, color.a * opacity);
#endif
  } else {
    vColor = vec4(color.rgb, color.a * opacity);
  }
  if(paintTopFace == 1.0 && normals.z == 1.0 && ((visualizeUncertainty == 1.0 && nColumn == 3) || visualizeUncertainty == 0.0)) { // && instanceElevations > 1.0 ?
    vColor = vec4(1.0, 0.0, 0.0, 1.0);
  }
  DECKGL_FILTER_COLOR(vColor, geometry);
}
`;

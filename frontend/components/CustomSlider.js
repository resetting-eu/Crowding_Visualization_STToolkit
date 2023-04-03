import { useState, useRef, useEffect } from 'react';
import Slider from '@mui/material/Slider'

function CustomSlider(props) {
  const {sx, colors, live, value, onChange, ...rest} = props;
  
  const trackList = colors ? colors.slice(0, value + 1).join(",") : null;
  const railList = colors ? colors.join(",") : null;

  const [thumbColor, setThumbColor] = useState("");
  const thumbColorRef = useRef("");
  const thumbBlinkingInterval = useRef(null);

  function thumbStartBlinking() {
    thumbBlinkingInterval.current = setInterval(() => {
      const color = thumbColorRef.current === "" ? "red" : "";
      thumbColorRef.current = color;
      setThumbColor(color);
    }, 500);
  }

  function thumbStopBlinking() {
    if(thumbBlinkingInterval.current) {
      clearInterval(thumbBlinkingInterval.current);
      thumbBlinkingInterval.current = null;
      thumbColorRef.current = "";
      setThumbColor("");
    }
  }

  useEffect(() => {
    if(live)
      thumbStartBlinking();
    else
      thumbStopBlinking();
  }, [live]);

  const trackAndRailStyles = colors ?
    {
      "& .MuiSlider-track": {
        backgroundImage: `linear-gradient(to right, ${trackList})`
      },
      "& .MuiSlider-rail": {
        backgroundImage: `linear-gradient(to right, ${railList})`
      }
    }
    : {};

  const staticStyles =
    {
      "& .MuiSlider-valueLabel.MuiSlider-valueLabelOpen": {
        transform: "translateY(125%) scale(1)"
      },
      "& .MuiSlider-valueLabel:before": {
        transform: "translate(-50%, -300%) rotate(45deg)"
      },
      "& .MuiSlider-thumb": {
        color: thumbColor
      }
    };

  return (
    <Slider {...rest}
      min={0}
      step={1}
      max={colors ? colors.length - 1 : 0}
      value={value}
      onChange={onChange}
      valueLabelDisplay="auto"
      sx={{...trackAndRailStyles, ...staticStyles}}/>
  );
}

export default CustomSlider;

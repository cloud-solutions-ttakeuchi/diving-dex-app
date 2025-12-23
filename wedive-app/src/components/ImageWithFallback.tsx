import React, { useState, useEffect } from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

type ImageWithFallbackProps = {
  source: { uri: string } | null;
  style: StyleProp<ImageStyle>;
  fallbackSource: any; // require('...') returns a number or object
};

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({ source, style, fallbackSource }) => {
  const [imgSource, setImgSource] = useState<any>(source && source.uri ? source : fallbackSource);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSource(source && source.uri ? source : fallbackSource);
    setHasError(false);
  }, [source]);

  const handleError = () => {
    if (!hasError) {
      if (source?.uri) {
        console.log(`[Image Load Error] Failed to load image from: ${source.uri}`);
      }
      setHasError(true);
      setImgSource(fallbackSource);
    }
  };

  return (
    <Image
      source={imgSource}
      style={style}
      onError={handleError}
    />
  );
};

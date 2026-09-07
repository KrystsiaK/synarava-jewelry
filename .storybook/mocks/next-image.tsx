import { forwardRef, type ImgHTMLAttributes } from "react";

type StoryImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  alt: string;
  fill?: boolean;
  preload?: boolean;
  quality?: number;
  src: string | { src: string };
};

const StoryImage = forwardRef<HTMLImageElement, StoryImageProps>(function StoryImage(
  { alt, fill, preload, quality, src, style, ...props },
  ref,
) {
  void preload;
  void quality;
  const resolvedSrc = typeof src === "string" ? src : src.src;
  return (
    // Storybook renders the native image so remote product media can be reviewed
    // without depending on the Next.js image optimizer endpoint.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      ref={ref}
      src={resolvedSrc}
      style={fill ? { ...style, position: "absolute", inset: 0, width: "100%", height: "100%" } : style}
      {...props}
    />
  );
});

export default StoryImage;

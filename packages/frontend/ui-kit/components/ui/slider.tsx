import {
  SliderFill,
  Slider as SliderPrimitive,
  SliderThumb,
  SliderTrack,
  type SliderProps as SliderPrimitiveProps,
  type SliderRenderProps,
} from "react-aria-components";

import { cn } from "../../lib/utils.ts";

type SliderProps = Omit<SliderPrimitiveProps, "className"> & {
  className?: string;
};

function Slider({ className, ...props }: SliderProps) {
  return (
    <SliderPrimitive
      data-slot="slider"
      className={cn(
        // RAC 写入 data-orientation，非 data-horizontal / data-vertical
        "group relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    >
      {({ state }: SliderRenderProps) => (
        <SliderTrack
          data-slot="slider-track"
          className="relative h-1.5 w-full grow rounded-full bg-input select-none dark:bg-input/80 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
        >
          <SliderFill
            data-slot="slider-range"
            className="absolute h-full rounded-full bg-primary select-none data-[orientation=vertical]:w-full"
          />
          {state.values.map((_: number, index: number) => (
            <SliderThumb
              data-slot="slider-thumb"
              key={index}
              index={index}
              className="relative top-1/2 block size-4 shrink-0 rounded-full border border-ring bg-background ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-3 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50 group-data-[orientation=vertical]:top-auto group-data-[orientation=vertical]:left-1/2"
            />
          ))}
        </SliderTrack>
      )}
    </SliderPrimitive>
  );
}

export { Slider };

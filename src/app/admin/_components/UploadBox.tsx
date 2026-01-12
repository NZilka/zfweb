"use client";

import { useUploadThing } from "~/utils/uploadthing";
import { useRouter } from "next/navigation";
import { type ProductType } from "./ProductForm";

// inferred input off useUploadThing
type Input = Parameters<typeof useUploadThing>;

const useUploadThingInputProps = (...args: Input) => {
  const $ut = useUploadThing(...args);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files);
    const result = await $ut.startUpload(selectedFiles);

    console.log("uploaded files", result);
    // TODO: persist result in state maybe?
  };

  return {
    inputProps: {
      onChange,
      multiple: ($ut.routeConfig?.image?.maxFileCount ?? 1) > 1,
      accept: "image/*",
    },
    isUploading: $ut.isUploading,
  };
};

function UploadSVG() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="size-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15"
      />
    </svg>
  );
}

const ImgBox = ({ type, num }: { type: string; num: string }) => {
  return (
    <div className="box-border flex h-64 w-64 items-center justify-center border-4 border-white p-4">
      <h1 className="text-2xl font-bold tracking-tight text-white">
        {type} {num}
      </h1>
    </div>
  );
};

function LoadingSpinnerSVG() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="white"
    >
      <path
        className="spinner_7mtw"
        d="M2,12A11.2,11.2,0,0,1,13,1.05C12.67,1,12.34,1,12,1a11,11,0,0,0,0,22c.34,0,.67,0,1-.05C6,23,2,17.74,2,12Z"
      />
    </svg>
  );
}

// const makeUploadToast = () => {
//   return toast(
//     <div className="flex items-center gap-2 text-white">
//       <LoadingSpinnerSVG />
//       <span className="text-lg">Uploading...</span>
//     </div>,
//     {
//       duration: 100000,
//       id: "upload-begin",
//     },
//   );
// };

// window.makeToast = makeUploadToast;

export type ErrorType = {
  message: string;
};

export function UploadBox({
  mediaType,
  num,
  onUploadCompleteAction,
  handleUploadErrorsAction,
}: {
  mediaType: string;
  num?: string;
  onUploadCompleteAction: (
    key: string,
    url: string,
    Mediatype: string,
    num: string,
  ) => void;
  handleUploadErrorsAction: (error: ErrorType) => void;
}) {
  const router = useRouter();
  //const posthog = usePostHog();

  const { inputProps } = useUploadThingInputProps("imageUploader", {
    onUploadBegin() {
      //   posthog.capture("upload_begin");
      //   toast(
      //     <div className="flex items-center gap-2 text-white">
      //       <LoadingSpinnerSVG />
      //       <span className="text-lg">Uploading...</span>
      //     </div>,
      //     {
      //       duration: 100000,
      //       id: "upload-begin",
      //     },
      //   );
    },
    onUploadError(error) {
      //   posthog.capture("upload_error", { error });
      //   toast.dismiss("upload-begin");
      //   toast.error(`Error uploading image - ${error.message}`);
      const message = error.message;
      console.error("Error uploading image", message);
      handleUploadErrorsAction({ message });
    },
    onClientUploadComplete(result) {
      console.log("oCUC result", result);
      if (result && result[0]) {
        const { key, url } = result[0];
        onUploadCompleteAction(key, url, mediaType, num || "");
      }

      //   toast.dismiss("upload-begin");
      //   toast("Image uploaded successfully", {
      //     id: "upload-success",
      //     duration: 3000,
      //     action: {
      //       label: "Dismiss",
      //       onClick: () => toast.dismiss("upload-success"),
      //     },
      //   });
      router.refresh();
    },
  });

  return (
    <div>
      <label htmlFor="upload-box" className="cursor-pointer">
        <ImgBox type={mediaType} num={num ?? ""} />
      </label>
      <input id="upload-box" type="file" className="sr-only" {...inputProps} />
    </div>
  );
}

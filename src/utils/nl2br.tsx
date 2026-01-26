import React from "react";

export function nl2br(value: string): React.ReactNode {
  return value.split(/(\r\n|\r|\n)/g).map((item, index) => {
    if (item.match(/(\r\n|\r|\n)/g)) {
      return (
        <React.Fragment key={index}>
          <br />
        </React.Fragment>
      );
    }
    return <React.Fragment key={index}>{item}</React.Fragment>;
  });
}
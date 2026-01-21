import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/commerce-sdk";

const textareaVariants = cva(
  "w-full p-12 text-label-2 rounded-medium border transition-all resize-none border-border-200 bg-background-0 hover:border-border-200-hover focus:border-border-brand focus:ring-2 focus:ring-border-brand focus:ring-offset-1 disabled:border-border-100 disabled:bg-background-50 disabled:text-text-primary-disabled disabled:cursor-not-allowed text-text-primary placeholder:text-text-tertiary outline-none"
);

/**
 * Textarea 컴포넌트 Props
 *
 * @property {ReactNode} children - Textarea.Actions 컴포넌트를 포함할 수 있음
 *
 * @description
 * - 상태(hover, focus, disabled)는 CSS pseudo-classes로 자동 처리
 * - Textarea.Actions를 children으로 전달하여 하단에 버튼/컨트롤 추가
 *
 * @example
 * ```tsx
 * // 기본 Textarea
 * <Textarea placeholder="내용을 입력하세요" rows={5} />
 *
 * // Actions와 함께 사용
 * <Textarea placeholder="댓글..." rows={3}>
 *   <Textarea.Actions>
 *     <Button buttonStyle="secondary">취소</Button>
 *     <Button>등록</Button>
 *     <span className="text-text-secondary text-label-m">0/500</span>
 *   </Textarea.Actions>
 * </Textarea>
 *
 * // 비활성화
 * <Textarea disabled value="수정 불가">
 *   <Textarea.Actions>
 *     <Button buttonStyle="secondary" disabled>취소</Button>
 *     <Button disabled>등록</Button>
 *   </Textarea.Actions>
 * </Textarea>
 * ```
 */
export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "children"> {
  children?: React.ReactNode;
}

/**
 * 여러 줄 텍스트 입력을 위한 Textarea 컴포넌트
 *
 * hover, focus, disabled 상태는 CSS pseudo-classes로 자동 처리됩니다.
 * Textarea.Actions를 children으로 전달하여 하단에 버튼과 컨트롤을 추가할 수 있습니다.
 */
const TextareaRoot = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, children, ...props }, ref) => {
    // children에서 Textarea.Actions 찾기
    const actionsChild = React.Children.toArray(children).find(
      (child) =>
        React.isValidElement(child) &&
        typeof child.type === "function" &&
        (child.type as React.ComponentType).displayName === "TextareaActions"
    );

    return (
      <div className="relative">
        <textarea
          ref={ref}
          className={cn(textareaVariants(), className)}
          {...props}
        />
        {actionsChild}
      </div>
    );
  }
);

TextareaRoot.displayName = "Textarea";

/**
 * TextareaActions 컴포넌트 Props
 *
 * @property {ReactNode} children - 버튼이나 컨트롤 등 자유롭게 배치할 수 있는 children
 *
 * @description
 * children을 받아서 우측 하단에 배치합니다.
 * 버튼, 문자 수, 기타 컨트롤을 자유롭게 추가할 수 있습니다.
 */
export interface TextareaActionsProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

/**
 * Textarea 하단에 버튼과 컨트롤을 표시하는 컴포넌트
 *
 * children을 받아서 우측 하단에 배치합니다.
 */
function TextareaActions({ children, className, ...props }: TextareaActionsProps) {
  return (
    <div
      data-slot="textarea-actions"
      className={cn("flex items-center justify-end gap-8 mt-8", className)}
      {...props}
    >
      {children}
    </div>
  );
}

TextareaActions.displayName = "TextareaActions";

// Compound Component 타입 정의
interface TextareaComponent
  extends React.ForwardRefExoticComponent<
    TextareaProps & React.RefAttributes<HTMLTextAreaElement>
  > {
  Actions: typeof TextareaActions;
}

const Textarea = TextareaRoot as TextareaComponent;
Textarea.Actions = TextareaActions;

export { Textarea, textareaVariants };

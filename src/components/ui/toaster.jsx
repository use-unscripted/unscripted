import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      <ToastViewport>
        {toasts.map(function ({
          id,
          title,
          description,
          action,
          onOpenChange,
          ...props
        }) {
          return (
            <Toast key={id} onOpenChange={onOpenChange} {...props}>
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
              {action}
              {/* The store already built onOpenChange and nothing called it,
                  which is why tapping the X did nothing at all. */}
              <ToastClose onClick={() => onOpenChange?.(false)} />
            </Toast>
          );
        })}
      </ToastViewport>
    </ToastProvider>
  );
} 
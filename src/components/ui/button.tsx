import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import Link, { type LinkProps } from "next/link";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "contrast" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "xl";

interface CommonButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

type ButtonAsButtonProps = CommonButtonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

type ButtonAsLinkProps = CommonButtonProps &
  Omit<LinkProps, "href" | "className"> &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children"> & {
    href: LinkProps["href"];
  };

export type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-primary text-ink shadow-[0_1px_2px_rgba(32,32,29,0.10)] hover:bg-primary-hover hover:shadow-[0_4px_12px_rgba(242,84,45,0.18)]",
  secondary:
    "border border-navy bg-navy text-white shadow-[0_1px_2px_rgba(5,18,54,0.12)] hover:bg-navy-deep",
  outline: "border border-line bg-paper text-ink shadow-[0_1px_1px_rgba(32,32,29,0.03)] hover:border-line-strong hover:bg-surface/65",
  ghost: "border border-transparent bg-transparent text-ink-soft hover:bg-surface hover:text-ink",
  contrast: "border border-white/20 bg-white text-navy hover:bg-cream",
  danger: "border border-transparent bg-red-600 text-white hover:bg-red-700",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-5 text-sm",
  xl: "h-11 px-6 text-base",
};

function getButtonClassName({
  variant,
  size,
  className,
  fullWidth,
}: Pick<CommonButtonProps, "variant" | "size" | "className" | "fullWidth">) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60",
    "focus-visible:outline-none",
    variantClass[variant ?? "primary"],
    sizeClass[size ?? "md"],
    fullWidth && "w-full",
    className,
  );
}

export function Button(props: ButtonProps) {
  const {
    className,
    variant = "primary",
    size = "md",
    children,
    fullWidth,
    leadingIcon,
    trailingIcon,
  } = props;

  const content = (
    <>
      {leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
      <span>{children}</span>
      {trailingIcon ? <span className="shrink-0">{trailingIcon}</span> : null}
    </>
  );

  if ("href" in props && props.href !== undefined) {
    const {
      href,
      prefetch,
      replace,
      scroll,
      onClick,
      variant: _variant,
      size: _size,
      className: _className,
      children: _children,
      fullWidth: _fullWidth,
      leadingIcon: _leadingIcon,
      trailingIcon: _trailingIcon,
      ...rest
    } = props;
    void _variant;
    void _size;
    void _className;
    void _children;
    void _fullWidth;
    void _leadingIcon;
    void _trailingIcon;
    const classNames = getButtonClassName({ variant, size, className, fullWidth });
    const isExternal = typeof href === "string" && /^(https?:)?\/\//.test(href);

    if (isExternal) {
      return (
        <a
          href={href as string}
          className={classNames}
          onClick={onClick}
          {...rest}
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        href={href}
        prefetch={prefetch}
        replace={replace}
        scroll={scroll}
        className={classNames}
        onClick={onClick}
        {...rest}
      >
        {content}
      </Link>
    );
  }

  const {
    type = "button",
    variant: _variant,
    size: _size,
    className: _className,
    children: _children,
    fullWidth: _fullWidth,
    leadingIcon: _leadingIcon,
    trailingIcon: _trailingIcon,
    ...rest
  } = props;
  void _variant;
  void _size;
  void _className;
  void _children;
  void _fullWidth;
  void _leadingIcon;
  void _trailingIcon;
  return (
    <button
      type={type}
      className={getButtonClassName({ variant, size, className, fullWidth })}
      {...rest}
    >
      {content}
    </button>
  );
}

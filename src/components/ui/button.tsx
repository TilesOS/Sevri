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
    "border-2 border-ink bg-primary text-ink shadow-soft hover:bg-primary-hover active:bg-primary-active active:shadow-none",
  secondary:
    "border-2 border-ink bg-surface text-ink shadow-soft hover:bg-surface-strong active:shadow-none",
  outline: "border-2 border-ink bg-paper text-ink shadow-soft hover:bg-surface active:shadow-none",
  ghost: "border-2 border-transparent bg-transparent text-ink hover:bg-surface/65",
  contrast: "border-2 border-contrast-line bg-contrast text-paper hover:border-white/20 hover:bg-contrast-soft",
  danger: "border-2 border-red-700 bg-red-600 text-white shadow-soft hover:bg-red-700 active:shadow-none",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
  xl: "h-14 px-7 text-base",
};

function getButtonClassName({
  variant,
  size,
  className,
  fullWidth,
}: Pick<CommonButtonProps, "variant" | "size" | "className" | "fullWidth">) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[box-shadow,background-color] duration-100 disabled:cursor-not-allowed disabled:opacity-60",
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

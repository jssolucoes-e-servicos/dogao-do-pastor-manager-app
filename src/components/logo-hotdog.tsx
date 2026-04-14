import { type SvgProps } from 'react-native-svg';
import Logo from '@/assets/images/svg/logo.svg';

type Props = SvgProps & { size?: number };

export function LogoHotdog({ size = 120, ...props }: Props) {
  return <Logo width={size} height={size * (170 / 197)} {...props} />;
}

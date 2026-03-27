import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './badge';
import { Button } from './button';
import { Input } from './input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { Switch } from './switch';
import { Tabs, TabsList, TabsTrigger } from './tabs';
import { Textarea } from './textarea';

describe('flat interactive primitives', () => {
  it('renders button variants with semantic lift classes and exposes compact size', () => {
    render(
      <>
        <Button>默认</Button>
        <Button variant="secondary" size="compact">
          紧凑
        </Button>
        <Button variant="outline">描边</Button>
      </>,
    );

    expect(
      screen.getByRole('button', { name: '默认' }).className,
    ).toContain('shadow-button');
    expect(screen.getByRole('button', { name: '紧凑' })).toHaveClass('h-8');
    expect(
      screen.getByRole('button', { name: '描边' }).className,
    ).toContain('shadow-field');
  });

  it('renders text inputs with semantic field shadows', () => {
    render(
      <>
        <Input aria-label="输入框" />
        <Textarea aria-label="多行输入框" />
        <Select defaultValue="15">
          <SelectTrigger aria-label="抓取间隔">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15">每 15 分钟</SelectItem>
          </SelectContent>
        </Select>
      </>,
    );

    expect(screen.getByLabelText('输入框').className).toContain('shadow-field');
    expect(screen.getByLabelText('多行输入框').className).toContain('shadow-field');
    expect(
      screen.getByRole('combobox', { name: '抓取间隔' }).className,
    ).toContain('shadow-field');
  });

  it('keeps switches flat while tabs and badges use semantic surface classes', () => {
    render(
      <>
        <Switch aria-label="开关" checked={false} onCheckedChange={() => {}} />
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">通用</TabsTrigger>
          </TabsList>
        </Tabs>
        <Badge>标签</Badge>
      </>,
    );

    expect(screen.getByRole('switch', { name: '开关' }).className).not.toContain(
      'shadow-sm',
    );
    expect(
      screen.getByRole('switch', { name: '开关' }).querySelector('span')
        ?.className,
    ).not.toContain('shadow');
    expect(screen.getByRole('tab', { name: '通用' }).className).toContain(
      'data-[state=active]:shadow-surface',
    );
    expect(screen.getByText('标签').className).toContain('shadow-button');
  });
});

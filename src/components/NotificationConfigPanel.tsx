"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NotificationService } from '@/lib/notificationService';
import { Bell, Settings, Save } from 'lucide-react';

interface NotificationConfigPanelProps {
  onConfigUpdate?: () => void;
}

export function NotificationConfigPanel({ onConfigUpdate }: NotificationConfigPanelProps) {
  const [config, setConfig] = useState({
    studentNotificationMinutes: 10,
    adminEscalationMinutes: 20,
    notificationCooldownMinutes: 5,
    emailEnabled: true,
    smsEnabled: true,
    pushEnabled: true,
    dashboardEnabled: true
  });

  const [channelConfig, setChannelConfig] = useState({
    emailService: 'mock' as 'smtp' | 'firebase' | 'mock',
    smsService: 'mock' as 'twilio' | 'firebase' | 'mock',
    pushService: 'mock' as 'firebase' | 'mock',
    emailFrom: 'noreply@eaglepass.edu',
    smsFrom: 'EaglePass'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    // Load current configuration (in a real app, this would come from the server)
    // For now, we'll use the defaults
  }, []);

  const handleConfigChange = (key: string, value: string | number | boolean) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleChannelConfigChange = (key: string, value: string) => {
    setChannelConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update notification service configuration
      NotificationService.updateConfig(config);
      NotificationService.updateChannelConfig({
        email: {
          service: channelConfig.emailService,
          from: channelConfig.emailFrom
        },
        sms: {
          service: channelConfig.smsService,
          from: channelConfig.smsFrom
        },
        push: {
          service: channelConfig.pushService
        }
      });

      setSaveMessage('Configuration saved successfully!');
      if (onConfigUpdate) {
        onConfigUpdate();
      }
      
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage('Failed to save configuration');
      console.error('Failed to save notification config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Notification Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Timing Configuration */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Escalation Timing</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="studentNotification">Student Notification (minutes)</Label>
              <Input
                id="studentNotification"
                type="number"
                value={config.studentNotificationMinutes}
                onChange={(e) => handleConfigChange('studentNotificationMinutes', parseInt(e.target.value))}
                min="1"
                max="60"
              />
              <p className="text-xs text-muted-foreground">
                When to send first teacher notification
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="adminEscalation">Admin Escalation (minutes)</Label>
              <Input
                id="adminEscalation"
                type="number"
                value={config.adminEscalationMinutes}
                onChange={(e) => handleConfigChange('adminEscalationMinutes', parseInt(e.target.value))}
                min="1"
                max="120"
              />
              <p className="text-xs text-muted-foreground">
                When to escalate to administrators
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cooldown">Cooldown Period (minutes)</Label>
              <Input
                id="cooldown"
                type="number"
                value={config.notificationCooldownMinutes}
                onChange={(e) => handleConfigChange('notificationCooldownMinutes', parseInt(e.target.value))}
                min="1"
                max="30"
              />
              <p className="text-xs text-muted-foreground">
                Minimum time between notifications
              </p>
            </div>
          </div>
        </div>

        {/* Channel Enable/Disable */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Notification Channels</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span>Email Notifications</span>
              </div>
              <Switch
                checked={config.emailEnabled}
                onCheckedChange={(checked) => handleConfigChange('emailEnabled', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span>SMS Notifications</span>
              </div>
              <Switch
                checked={config.smsEnabled}
                onCheckedChange={(checked) => handleConfigChange('smsEnabled', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span>Push Notifications</span>
              </div>
              <Switch
                checked={config.pushEnabled}
                onCheckedChange={(checked) => handleConfigChange('pushEnabled', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span>Dashboard Alerts</span>
              </div>
              <Switch
                checked={config.dashboardEnabled}
                onCheckedChange={(checked) => handleConfigChange('dashboardEnabled', checked)}
              />
            </div>
          </div>
        </div>

        {/* Channel Configuration */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Channel Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emailService">Email Service</Label>
              <Select
                value={channelConfig.emailService}
                onValueChange={(value) => handleChannelConfigChange('emailService', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock">Mock (Development)</SelectItem>
                  <SelectItem value="smtp">SMTP Server</SelectItem>
                  <SelectItem value="firebase">Firebase Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="emailFrom">Email From Address</Label>
              <Input
                id="emailFrom"
                type="email"
                value={channelConfig.emailFrom}
                onChange={(e) => handleChannelConfigChange('emailFrom', e.target.value)}
                placeholder="noreply@eaglepass.edu"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="smsService">SMS Service</Label>
              <Select
                value={channelConfig.smsService}
                onValueChange={(value) => handleChannelConfigChange('smsService', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock">Mock (Development)</SelectItem>
                  <SelectItem value="twilio">Twilio</SelectItem>
                  <SelectItem value="firebase">Firebase SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="smsFrom">SMS From Name</Label>
              <Input
                id="smsFrom"
                type="text"
                value={channelConfig.smsFrom}
                onChange={(e) => handleChannelConfigChange('smsFrom', e.target.value)}
                placeholder="EaglePass"
                maxLength={11}
              />
            </div>
          </div>
        </div>

        {/* Test Notification */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Test Notifications</h3>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1">
              Send Test Email
            </Button>
            <Button variant="outline" className="flex-1">
              Send Test SMS
            </Button>
            <Button variant="outline" className="flex-1">
              Send Test Push
            </Button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            {saveMessage && (
              <p className={`text-sm ${saveMessage.includes('Failed') ? 'text-red-500' : 'text-green-500'}`}>
                {saveMessage}
              </p>
            )}
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 
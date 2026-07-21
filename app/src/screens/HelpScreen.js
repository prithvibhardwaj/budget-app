import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { colors, categoryColors } from '../theme';
import { Card, Title } from '../components/ui';

function Row({ left, right }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 8 }}>
      <Text style={{ color: colors.ink, fontSize: 13, fontFamily: 'monospace', width: 150 }}>{left}</Text>
      <Text style={{ color: colors.secondary, fontSize: 13, flex: 1 }}>{right}</Text>
    </View>
  );
}

export default function HelpScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.page }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Card>
        <Title>Logging expenses</Title>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>
          Text yourself in WhatsApp (Note to Self). Everything below also works in the app via the + button.
        </Text>
        <Row left={'Guzman 11.8'} right="Logs 11.80 as Food" />
        <Row left={'grab 14.5'} right="Logs as Transport" />
        <Row left={'bubble tea 3'} right="Logs as Drinks" />
        <Row left={'75 myr nasi lemak'} right="Explicit currency; otherwise your location's currency is used" />
        <Row left={'laptop 1200'} right="Logged and flagged as a heavy one-off ⚠️" />
        <Row left={'buy milk tomorrow'} right="Ignored — notes without amounts are never logged" />
      </Card>

      <Card>
        <Title>SWS fund</Title>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>
          Fully separate from monthly spending — SWS entries never appear in your totals or charts.
        </Text>
        <Row left={'sws 20 groceries'} right="Spend 20 from the fund 🏦" />
        <Row left={'nsws 50'} right="Top the fund back up 💰" />
      </Card>

      <Card>
        <Title>Fixing mistakes</Title>
        <Row left={'reply to a message'} right="Re-parses your reply and corrects that entry ✏️" />
        <Row left={'reply "delete"'} right="Removes that entry 🗑️" />
        <Row left={'//undo'} right="Removes the latest expense" />
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
          In the app: tap an expense to edit it, long-press to select and delete.
        </Text>
      </Card>

      <Card>
        <Title>WhatsApp commands</Title>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>
          Start a message with // — commands are never logged as expenses. The bot replies in chat; its replies start with 🤖.
        </Text>
        <Row left={'//help'} right="List all commands" />
        <Row left={'//today'} right="Today's spending by category" />
        <Row left={'//week'} right="Last 7 days" />
        <Row left={'//month'} right="This month, including fixed expenses" />
        <Row left={'//sws'} right="SWS fund balance" />
        <Row left={'//last'} right="Five most recent entries" />
        <Row left={'//undo'} right="Remove the latest expense" />
      </Card>

      <Card>
        <Title>Reactions</Title>
        <Row left={'✅'} right="Expense logged" />
        <Row left={'⚠️'} right="Logged and flagged heavy" />
        <Row left={'🏦'} right="SWS fund spend" />
        <Row left={'💰'} right="SWS fund top-up" />
        <Row left={'✏️'} right="Entry corrected" />
        <Row left={'🗑️'} right="Entry deleted" />
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
          No reaction? The message wasn't recognized as an expense — it stays untouched.
        </Text>
      </Card>

      <Card>
        <Title>Categories</Title>
        {Object.entries(categoryColors).map(([name, color]) => (
          <View key={name} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color, marginRight: 8 }} />
            <Text style={{ color: colors.secondary, fontSize: 13 }}>{name}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}
